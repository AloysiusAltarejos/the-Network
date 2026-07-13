from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User
from requests import post, request
from .forms import RegisterForm
from django.db.models import Q, Count 
from django.shortcuts import render, redirect, get_object_or_404
from .models import Profile, Post, Report, Notification, Comment, Message, Thread, ThreadNickname, Story, StoryView
import re, json
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache
from django.core.files.uploadedfile import UploadedFile
from PIL import Image


def _remove_notifications(**filters):
    if not filters:
        return
    Notification.objects.filter(**filters).delete()

@login_required(login_url='login')
def profile_view(request, username=None):
    if username:
        target_user = get_object_or_404(User, username=username)
    else:
        target_user = request.user
    #get the current tab
    current_tab = request.GET.get('tab', 'posts')
    
    if current_tab == 'liked':
        items_list = Post.objects.filter(likes=target_user).order_by('-created_at')
    elif current_tab == 'disliked':
        items_list = Post.objects.filter(dislikes=target_user).order_by('-created_at')
    elif current_tab == 'replies':
        items_list = Comment.objects.filter(author=target_user).order_by('-created_at')
    else:
        # basically the defualt
        items_list = Post.objects.filter(author=target_user).order_by('-created_at')
        
# 4. Limit view to 10 items to save CPU/RAM
    paginator = Paginator(items_list, 10) 
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    # send to the template
    return render(request, 'profile.html', {
        'target_user': target_user,
        'page_obj': page_obj,
        'current_tab': current_tab
    })

@login_required(login_url='login')
def update_profile(request):
    if request.method == "POST":
        profile, created = Profile.objects.get_or_create(user=request.user)
        field_to_update = request.POST.get('field')
        new_value = request.POST.get('value')
        if field_to_update == 'profile_picture' and request.FILES.get('image_upload'):
            profile.profile_picture = request.FILES['image_upload']
            profile.save()
            return redirect('profile')
        elif field_to_update == 'remove_picture':
            if profile.profile_picture:
                profile.profile_picture.delete(save=False) 
            profile.profile_picture = None
            profile.save()
            return redirect('profile')
        if field_to_update == 'name':
            profile.name = new_value
        elif field_to_update == 'pronouns':
            profile.pronouns = new_value
        elif field_to_update == 'location':
            profile.location = new_value
        elif field_to_update == 'bio':
            profile.bio = new_value
        profile.save()
    return redirect('profile')

def registration_view(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('home')
    else:
        form = RegisterForm()
    return render(request, 'registration.html', {'form': form})

def login_view(request):
    if request.method == "POST":
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('home')
    else:
        form = AuthenticationForm()
    return render(request, 'login.html', {'form': form})

@login_required(login_url='login')
def search_view(request):
    query = request.GET.get('q') 
    results = []
    if query:
        results = User.objects.filter(
            Q(username__icontains=query) | Q(profile__name__icontains=query)
        ).distinct()
    return render(request, 'search.html', {'results': results, 'query': query})

@login_required(login_url='login')
def home_view(request):
    post_list = Post.objects.all().order_by('-created_at')
    paginator = Paginator(post_list, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    if request.method == "POST":
        image = request.FILES.get('image')
        if image and not _is_safe_image(image):
            messages.error(request, "⚠︎ Unsupported or oversized image upload. Max size is 5MB.")
            return redirect('home')
        content = request.POST.get('content')
        #followers visibility
        visibility = request.POST.get('visibility') 
        is_followers_only = (visibility == 'followers')
        #image handlers of posts
        image = request.FILES.get('image')
        if image:
            photo_post_count = Post.objects.filter(
                author=request.user, 
                image__isnull=False
            ).exclude(image='').count()
            if photo_post_count >= 10:
                post = Post.objects.create(
                author=request.user, 
                content=content,
                followers_only=is_followers_only
            )
            messages.error(request, "Limit reached: You can only have 10 photo posts on your account. Fund the author: Aloy the goat so he can get a bigger server to store stuff")
            return redirect('home')
        if content:
            new_post = Post.objects.create(
                author=request.user, 
                content=content, 
                image=image,
                followers_only=is_followers_only
                )
            tagged_usernames = re.findall(r'@(\w+)', content)
            for tagged_name in tagged_usernames:
                try:
                    tagged_user = User.objects.get(username=tagged_name)
                    if tagged_user != request.user:
                        Notification.objects.create(
                            recipient=tagged_user, 
                            sender=request.user, 
                            notification_type='tag',
                            post=new_post
                        )
                except User.DoesNotExist:
                    pass
        return redirect('home')
    feed_type = request.GET.get('feed', 'global')
    if feed_type == 'following':
        # 1. Get the list of Profile objects the user follows
        following_profiles = request.user.profile.following.all() 
        #Extract the actual User objects from those profiles
        following_users = [profile.user for profile in following_profiles]
        # Filter using the correct User objects
        post_list = Post.objects.filter( Q (author__in=following_users) | Q(author=request.user)).order_by('-created_at').distinct()
        
    else:
        # Global: Show all posts, except ones marked 'followers_only'
        post_list = Post.objects.filter(followers_only=False).order_by('-created_at')

    paginator = Paginator(post_list, 15) 
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # --- Stories feature ---
    time_threshold = timezone.now() - timedelta(hours=24)
    
    # Calculate remaining story limits for the current user
    active_user_stories = Story.objects.filter(author=request.user, created_at__gte=time_threshold)
    
    # If it has an image, it's an image story. Otherwise, it's a text story.
    image_story_count = active_user_stories.filter(image__isnull=False).count()
    text_story_count = active_user_stories.filter(image__isnull=True).exclude(text_content='').count()

    text_left = max(0, 5 - text_story_count)
    image_left = max(0, 3 - image_story_count)

    # Query for active stories available
    active_stories = Story.objects.filter(
        Q(created_at__gte=time_threshold) &
        (   Q(author=request.user) |
            Q(visibility='public') |
            Q(visibility='followers', author__profile__followers=request.user.profile) |
            Q(visibility='custom', allowed_threads__participants=request.user)
        )
    ).select_related('author', 'author__profile').distinct().order_by('author', 'created_at')

    # make stories into dictionaries to be processed by JavaScrit
    stories_data = {}
    for story in active_stories:
        uname = story.author.username
        if uname not in stories_data:
            # Check if profile pic exist to see if it is a valid account.
            try:
                pic_url = story.author.profile.profile_picture.url if story.author.profile.profile_picture else ''
            except ValueError:
                pic_url = ''

            stories_data[uname] = {
                'username': uname,
                'pic_url': pic_url,
                'items': []
            }
        
        stories_data[uname]['items'].append({
            'id': story.id,
            'image_url': story.image.url if story.image else None,
            'text_content': story.text_content,
            'created_at': story.created_at.isoformat(),
            'viewed': story.views.filter(viewer=request.user).exists(),
            'is_liked': story.likes.filter(id=request.user.id).exists(),
            'is_mine': story.author == request.user
        })

    stories_json = json.dumps(list(stories_data.values()))
    user_threads = request.user.threads.exclude(deleted_by=request.user).order_by('-updated_at').prefetch_related('participants')
    
    # suggested accounts system
    my_profile = request.user.profile
    my_following = my_profile.following.all()

    # find mutuals/friends of my firends 
    mutuals = Profile.objects.filter(
        followers__in=my_following
    ).exclude(
        id=my_profile.id
    ).exclude(
        id__in=my_following.values_list('id', flat=True)
    ).annotate(
        mutual_count=Count('followers')
    ).order_by('-mutual_count')[:5]
    
    #  find newly created accounts
    new_users = Profile.objects.exclude(
        id=my_profile.id
    ).exclude(
        id__in=my_following.values_list('id', flat=True)
    ).order_by('-user__date_joined')[:5]
    
    # making suggestions at 5 max
    suggested_profiles = list(mutuals)
    for profile in new_users:
        if profile not in suggested_profiles:
            suggested_profiles.append(profile)
        if len(suggested_profiles) >= 5:
            break


    # Pass the current feed type to the template so it highlights the correct tab
    return render(request, 'home.html', {
        'page_obj': page_obj,
        'current_feed': feed_type,
        'stories_json': stories_json,
        'user_threads': user_threads,
        'suggested_profiles': suggested_profiles,
        'text_left': text_left,
        'image_left': image_left
    })

@login_required(login_url='login')
def messages_view(request):
    return render(request, 'messages.html')

@login_required(login_url='login')
def base_view(request):
    return render(request, 'base.html')

def baseEntrance_view(request):
    return render(request, 'baseEntrance.html')

def logout_view(request):
    logout(request)
    return redirect('login')

@login_required(login_url='login')
def toggle_hide_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    if request.user == post.author:
        post.is_hidden = not post.is_hidden
        post.save()
    return redirect('home')

@login_required(login_url='login')
def delete_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    if request.user == post.author:
        Notification.objects.filter(post=post).delete()
        post.delete()
    return redirect('home')

@login_required(login_url='login')
def report_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    if request.user != post.author:
        Report.objects.get_or_create(post=post, reported_by=request.user)
    return redirect('home')

#followers
@login_required(login_url='login')
def toggle_follow(request, username):
    target_profile = get_object_or_404(Profile, user__username=username)
    if request.user != target_profile.user:
        if request.user.profile in target_profile.followers.all():
            target_profile.followers.remove(request.user.profile)
            _remove_notifications(
                recipient=target_profile.user,
                sender=request.user,
                notification_type='follow'
            )
            Notification.objects.create(
                recipient=target_profile.user,
                sender=request.user,
                notification_type='unfollow'
            )
        else:
            target_profile.followers.add(request.user.profile)
            _remove_notifications(
                recipient=target_profile.user,
                sender=request.user,
                notification_type='unfollow'
            )
            Notification.objects.create(
                recipient=target_profile.user,
                sender=request.user,
                notification_type='follow'
            )
    return redirect('user_profile', username=username)

@login_required(login_url='login')
def toggle_like(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    already_liked = request.user in post.likes.all()
    if _rate_limited(request):
        return JsonResponse({"error": "Too many requests"}, status=429)
    if already_liked:
        post.likes.remove(request.user)
        _remove_notifications(
            recipient=post.author,
            sender=request.user,
            notification_type='like',
            post=post
        )
        status = 'unliked'
    else:
        post.likes.add(request.user)
        post.dislikes.remove(request.user)

        if request.user != post.author:
            _remove_notifications(
                recipient=post.author,
                sender=request.user,
                notification_type='like',
                post=post
            )
            _remove_notifications(
                recipient=post.author,
                sender=request.user,
                notification_type='dislike',
                post=post
            )
            Notification.objects.create(
                recipient=post.author,
                sender=request.user,
                notification_type='like',
                post=post
            )

        status = 'liked'

    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'likes': post.likes.count(),
            'dislikes': post.dislikes.count(),
            'status': status
        })

    return redirect(request.META.get('HTTP_REFERER', 'home'))


@login_required(login_url='login')
def toggle_dislike(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    already_disliked = request.user in post.dislikes.all()
    if _rate_limited(request):
        return JsonResponse({"error": "Too many requests"}, status=429)
    if already_disliked:
        post.dislikes.remove(request.user)
        _remove_notifications(
            recipient=post.author,
            sender=request.user,
            notification_type='dislike',
            post=post
        )
        status = 'undisliked'
    else:
        post.dislikes.add(request.user)
        post.likes.remove(request.user)

        if request.user != post.author:
            _remove_notifications(
                recipient=post.author,
                sender=request.user,
                notification_type='dislike',
                post=post
            )
            _remove_notifications(
                recipient=post.author,
                sender=request.user,
                notification_type='like',
                post=post
            )
            Notification.objects.create(
                recipient=post.author,
                sender=request.user,
                notification_type='dislike',
                post=post
            )

        status = 'disliked'

    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'likes': post.likes.count(),
            'dislikes': post.dislikes.count(),
            'status': status
        })

    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def postDetail(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    # compile all the replies for specific post
    comments_list = post.comments.all().order_by('-created_at')
    # 2. put them in specific pages
    paginator = Paginator(comments_list, 10) 
    page_number = request.GET.get('page')
    # 3. paginated object for the replies. Remember we have replies as "comments"
    comments = paginator.get_page(page_number)
    if request.method == 'POST':
        content = request.POST.get('content')
        parent_id = request.POST.get('parent_id')
        if content:
            parent_comment = None
            if parent_id:
                parent_comment = Comment.objects.get(id=parent_id)
            new_comment = Comment.objects.create(
                post=post, 
                author=request.user, 
                content=content,
                parent=parent_comment
            )
            tagged_usernames = re.findall(r'@(\w+)', content)
            for tagged_name in tagged_usernames:
                try:
                    tagged_user = User.objects.get(username=tagged_name)
                    if tagged_user != request.user:
                        Notification.objects.create(
                            recipient=tagged_user, 
                            sender=request.user, 
                            notification_type='tag',
                            post=post,
                            comment=new_comment
                        )
                except User.DoesNotExist:
                    pass
            if parent_comment and request.user != parent_comment.author:
                Notification.objects.create(
                    recipient=parent_comment.author, 
                    sender=request.user, 
                    notification_type='comment',
                    post=post,
                    comment=new_comment
                )
            elif not parent_comment and request.user != post.author:
                Notification.objects.create(
                    recipient=post.author, 
                    sender=request.user, 
                    notification_type='comment',
                    post=post,
                    comment=new_comment
                )
            return redirect('postDetail', post_id=post.id)
    all_comments = list(post.comments.all())
    comment_indices = {comment.id: idx for idx, comment in enumerate(all_comments, start=1)}
    for comment in all_comments:
        comment.thread_index = comment_indices[comment.id]
        if comment.parent_id:
            comment.parent_index = comment_indices.get(comment.parent_id)
    return render(request, 'postDetail.html', {
        'post': post, 
        'comments': comments
    })


@login_required(login_url='login')
def inbox(request):
    user_threads = request.user.threads.exclude(deleted_by=request.user).order_by('-updated_at')
    
    chat_data = []
    for thread in user_threads:
        last_message = thread.messages.order_by('-created_at').first()
        
        partner = None
        if not thread.is_group:
            partner = thread.participants.exclude(id=request.user.id).first()
            if not partner:
                partner = request.user
        
        unread_count = thread.messages.exclude(sender=request.user).exclude(read_by=request.user).count()
        
        chat_data.append({
            'thread': thread,
            'partner': partner,
            'last_message': last_message,
            'unread_count': unread_count 
        })
    return render(request, 'inbox.html', {'chat_data': chat_data})

@login_required(login_url='login')
def chat_thread(request, username):
    other_user = get_object_or_404(User, username=username)
    thread = request.user.threads.filter(is_group=False).filter(participants=other_user).first()
    if not thread:
        thread = Thread.objects.create(is_group=False, name="")
        thread.participants.add(request.user)
        thread.participants.add(other_user)
        thread.save()
    if request.method == 'POST':
        content = request.POST.get('content')
        if content:
            msg = Message.objects.create(thread=thread, sender=request.user, content=content)
            thread.deleted_by.clear()
            msg.read_by.add(request.user)
            thread.save()
            return redirect('chat_thread', username=username)
    unread_messages = thread.messages.exclude(read_by=request.user)
    for msg in unread_messages:
        msg.read_by.add(request.user)
    all_users = User.objects.exclude(id=request.user.id)
    recent_messages = thread.messages.all().order_by('-created_at')[:20]
    messages_to_display = reversed(recent_messages)
    return render(request, 'messages.html', {
        'other_user': other_user, 
        'thread': thread,
        'messages': messages_to_display,
        'all_users': all_users
    })

@login_required(login_url='login')
def delete_notification(request, notif_id):
    if request.method == "POST":
        notif = get_object_or_404(Notification, id=notif_id, recipient=request.user)
        notif.delete()
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def clear_all_notifications(request):
    if request.method == "POST":
        Notification.objects.filter(recipient=request.user).delete()
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def toggle_comment_like(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    already_liked = request.user in comment.likes.all()
    if _rate_limited(request):
        return JsonResponse({"error": "Too many requests"}, status=429) 

    if already_liked:
        comment.likes.remove(request.user)
        _remove_notifications(
            recipient=comment.author,
            sender=request.user,
            notification_type='like',
            post=comment.post,
            comment=comment
        )
        status = 'unliked'
    else:
        comment.likes.add(request.user)
        comment.dislikes.remove(request.user)

        if request.user != comment.author:
            _remove_notifications(
                recipient=comment.author,
                sender=request.user,
                notification_type='like',
                post=comment.post,
                comment=comment
            )
            _remove_notifications(
                recipient=comment.author,
                sender=request.user,
                notification_type='dislike',
                post=comment.post,
                comment=comment
            )
            Notification.objects.create(
                recipient=comment.author,
                sender=request.user,
                notification_type='like',
                post=comment.post,
                comment=comment
            )

        status = 'liked'

    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'likes': comment.likes.count(),
            'dislikes': comment.dislikes.count(),
            'status': status
        })

    return redirect(request.META.get('HTTP_REFERER', 'home'))


@login_required(login_url='login')
def toggle_comment_dislike(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    already_disliked = request.user in comment.dislikes.all()

    if _rate_limited(request):
        return JsonResponse({"error": "Too many requests"}, status=429) 

    if already_disliked:
        comment.dislikes.remove(request.user)
        _remove_notifications(
            recipient=comment.author,
            sender=request.user,
            notification_type='dislike',
            post=comment.post,
            comment=comment
        )
        status = 'undisliked'
    else:
        comment.dislikes.add(request.user)
        comment.likes.remove(request.user)

        if request.user != comment.author:
            _remove_notifications(
                recipient=comment.author,
                sender=request.user,
                notification_type='dislike',
                post=comment.post,
                comment=comment
            )
            _remove_notifications(
                recipient=comment.author,
                sender=request.user,
                notification_type='like',
                post=comment.post,
                comment=comment
            )
            Notification.objects.create(
                recipient=comment.author,
                sender=request.user,
                notification_type='dislike',
                post=comment.post,
                comment=comment
            )

        status = 'disliked'

    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'likes': comment.likes.count(),
            'dislikes': comment.dislikes.count(),
            'status': status
        })

    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def toggle_hide_comment(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    if request.user == comment.author:
        comment.is_hidden = not comment.is_hidden
        comment.save()
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def delete_comment(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    if request.user == comment.author:
        Notification.objects.filter(comment=comment).delete()
        comment.delete()
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def report_comment(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    if request.user != comment.author:
        Report.objects.get_or_create(comment=comment, reported_by=request.user)
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def create_group_thread(request):
    if request.method == 'POST':
        user_ids = request.POST.getlist('users')
        group_name = request.POST.get('group_name', 'New Group')

        if user_ids:
            thread = Thread.objects.create(is_group=True, name=group_name)
            thread.participants.add(request.user) 
            for uid in user_ids:
                thread.participants.add(uid)
            return redirect('group_chat_thread', thread_id=thread.id)
            
    return redirect('inbox')
            
    return redirect('group_chat_thread', thread_id=thread.id)
@login_required(login_url='login')
def group_chat_thread(request, thread_id):
    thread = get_object_or_404(Thread, id=thread_id, participants=request.user)
    if request.method == 'POST':
        content = request.POST.get('content')
        if content:
            msg = Message.objects.create(thread=thread, sender=request.user, content=content)
            thread.deleted_by.clear()
            msg.read_by.add(request.user)
            thread.save()
            return redirect('group_chat_thread', thread_id=thread.id)
            
    messages = thread.messages.all()
    for msg in messages.exclude(read_by=request.user):
        msg.read_by.add(request.user)
        
    all_users = User.objects.exclude(id=request.user.id)
        
    return render(request, 'messages.html', {
        'thread': thread,
        'messages': messages,
        'all_users': all_users
    })

@login_required(login_url='login')
def thread_settings(request, thread_id):
    thread = get_object_or_404(Thread, id=thread_id, participants=request.user)
    action = request.POST.get('action')

    if request.method == 'POST':
        if action == 'mute':
            if request.user in thread.muted_by.all():
                thread.muted_by.remove(request.user)
            else:
                thread.muted_by.add(request.user)

        elif action == 'delete_me':
            thread.deleted_by.add(request.user)
            return redirect('inbox')

        elif action == 'delete_both':
            thread.delete()
            return redirect('inbox')

        elif action == 'kick' and thread.is_group:
            target_user = get_object_or_404(User, id=request.POST.get('target_user_id'))
            thread.participants.remove(target_user)
            thread.deleted_by.add(target_user)
            if thread.participants.count() == 0:
                thread.delete()

        elif action == 'add' and thread.is_group:
            target_user = get_object_or_404(User, id=request.POST.get('target_user_id'))
            thread.participants.add(target_user)
            thread.deleted_by.remove(target_user) 

        elif action == 'change_picture' and thread.is_group:
            picture = request.FILES.get('group_picture')
            if picture:
                thread.group_picture = picture
                thread.save()
                Message.objects.create(thread=thread, sender=request.user, content=f"{request.user.username} changed the group profile picture.", is_system=True)

        elif action == 'change_name' and thread.is_group:
            new_name = request.POST.get('new_name')
            if new_name:
                thread.name = new_name
                thread.save()
                Message.objects.create(thread=thread, sender=request.user, content=f"{request.user.username} changed the group name to '{new_name}'.", is_system=True)

        elif action == 'change_nickname':
            target_user = get_object_or_404(User, id=request.POST.get('target_user_id'))
            new_nickname = request.POST.get('nickname')
            nn_obj, created = ThreadNickname.objects.get_or_create(thread=thread, user=target_user)
            
            if new_nickname:
                nn_obj.nickname = new_nickname
                nn_obj.save()
                Message.objects.create(thread=thread, sender=request.user, content=f"{request.user.username} set @{target_user.username}'s nickname to '{new_nickname}'.", is_system=True)
            else:
                nn_obj.delete()
                Message.objects.create(thread=thread, sender=request.user, content=f"{request.user.username} cleared @{target_user.username}'s nickname.", is_system=True)

    if thread.is_group:
        return redirect('group_chat_thread', thread_id=thread.id)
    else:
        other_user = thread.participants.exclude(id=request.user.id).first()
        return redirect('chat_thread', username=other_user.username if other_user else request.user.username)
    
@login_required(login_url='login')
def delete_account(request):
    if request.method == 'POST':
        user_to_delete = request.user

        #  Erase all Direct Messages
        Thread.objects.filter(participants=user_to_delete, is_group=False).delete()

        # The Ghost User Transfer (For Group Chats)
        # dummy/Ghost account as placeholder
        ghost_user, created = User.objects.get_or_create(
            username='deleted account',
            defaults={'is_active': False}
        )

        # Only affects messages sent by the user inside Group Threads
        Message.objects.filter(sender=user_to_delete, thread__is_group=True).update(sender=ghost_user)

        # deletes everything 
        user_to_delete.delete()
        
        # Log out user
        logout(request)
        return redirect('login')
        
    return redirect('home')

# Story Viewcount
@login_required(login_url='login')
@require_POST
def mark_story_viewed(request, story_id):
    story = get_object_or_404(Story, id=story_id)
    # Don't count the author of the story viewing their own story
    if story.author != request.user:
        StoryView.objects.get_or_create(story=story, viewer=request.user)
    return JsonResponse({'status': 'success'})

# User deletes their own story prematurely
@login_required(login_url='login')
@require_POST
def delete_story(request, story_id):
    story = get_object_or_404(Story, id=story_id, author=request.user)
    story.delete()
    return JsonResponse({'status': 'deleted'})

@login_required(login_url='login')
def create_story(request):
    if request.method == 'POST':
        #security issue for people trying to upload a large ass file
        image = request.FILES.get("image")
        if image and not _is_safe_image(image):
            messages.error(request, "⚠︎ Unsupported or oversized image upload. Max size is 5MB.")
            return redirect('home')
        #  Grab the data from the HTML form
        text_content = request.POST.get('text_content', '').strip()
        image = request.FILES.get('image')
        visibility = request.POST.get('visibility', 'public')
        custom_threads = request.POST.getlist('custom_threads')

        #  Re-calculate limits on the backend for security
        time_threshold = timezone.now() - timedelta(hours=24)
        active_user_stories = Story.objects.filter(author=request.user, created_at__gte=time_threshold)
        
        image_story_count = active_user_stories.filter(image__isnull=False).count()
        text_story_count = active_user_stories.filter(image__isnull=True).exclude(text_content='').count()

        new_story = None

        # Save the story if within limits
        if image:
            if image_story_count < 3:
                new_story = Story.objects.create(author=request.user, image=image, visibility=visibility)
        elif text_content:
            if text_story_count < 5:
                new_story = Story.objects.create(author=request.user, text_content=text_content, visibility=visibility)
                
        # customized visibility
        if new_story and visibility == 'custom' and custom_threads:
            new_story.allowed_threads.set(custom_threads)
    return redirect('home')

@login_required(login_url='login')
def get_story_viewers(request, story_id):
    story = get_object_or_404(Story, id=story_id)
    if story.author != request.user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    viewers = story.views.all().order_by('-viewed_at').select_related('viewer', 'viewer__profile')
    story_likes = story.likes.all()
    
    viewers_data = []
    for v in viewers:
        try:
            pic_url = v.viewer.profile.profile_picture.url if v.viewer.profile.profile_picture else ''
        except ValueError:
            pic_url = ''
            
        viewers_data.append({
            'username': v.viewer.username,
            'name': v.viewer.profile.name if v.viewer.profile.name else v.viewer.username,
            'pic_url': pic_url,
            'liked': v.viewer in story_likes
        })
        
    return JsonResponse({'viewers': viewers_data})

@login_required(login_url='login')
@require_POST
def like_story(request, story_id):
    story = get_object_or_404(Story, id=story_id)
    if request.user in story.likes.all():
        story.likes.remove(request.user)
        Notification.objects.filter(recipient=story.author, sender=request.user, notification_type='like', story=story).delete()
        return JsonResponse({'status': 'unliked'})
    else:
        story.likes.add(request.user)
        if request.user != story.author:
            Notification.objects.create(
                recipient=story.author,
                sender=request.user,
                notification_type='like',
                story=story
            )

    return JsonResponse({'status': 'liked'})

@login_required(login_url='login')
@require_POST
def reply_to_story(request, story_id):
    story = get_object_or_404(Story, id=story_id)
    reply_content = request.POST.get('content')
    
    if not reply_content or story.author == request.user:
        return JsonResponse({'error': 'Invalid reply'}, status=400)
        
    threads = Thread.objects.filter(is_group=False, participants=request.user).filter(participants=story.author)
    if threads.exists():
        thread = threads.first()
    else:
        thread = Thread.objects.create(is_group=False)
        thread.participants.add(request.user, story.author)
        
    formatted_reply = f"[Story Reply] {reply_content}"
    Message.objects.create(thread=thread, sender=request.user, content=formatted_reply)
    
    Notification.objects.create(
        recipient=story.author,
        sender=request.user,
        notification_type='comment',
        story=story
    )
    
    return JsonResponse({'status': 'replied'})




















#security debuggggg
def _is_safe_image(upload):
    if not isinstance(upload, UploadedFile) or not upload:
        return False
    if upload.size > 15 * 1024 * 1024:
        return False

    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if getattr(upload, "content_type", None) not in allowed_types:
        return False

    try:
        upload.seek(0)
        with Image.open(upload) as img:
            img.verify()
        upload.seek(0)
        return True
    except Exception:
        return False

def _rate_limited(request, limit=30, window=30):
    if not request.user.is_authenticated:
        return False

    key = f"rl:{request.user.id}:{request.path}"
    count = cache.get(key, 0)
    if count >= limit:
        return True

    cache.set(key, count + 1, window)
    return False