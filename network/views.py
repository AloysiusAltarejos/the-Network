from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User
from requests import post, request
from .forms import RegisterForm
from django.db.models import Q 
from django.shortcuts import render, redirect, get_object_or_404
from .models import Profile, Post, Report, Notification, Comment, Message
import re


@login_required(login_url='login')
def profile_view(request, username=None):
    if username:
        target_user = get_object_or_404(User, username=username)
    else:
        target_user = request.user
    return render(request, 'profile.html', {'target_user': target_user})

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
    if request.method == "POST":
        content = request.POST.get('content')
        image = request.FILES.get('image')
        if image:
            photo_post_count = Post.objects.filter(
                author=request.user, 
                image__isnull=False
            ).exclude(image='').count()
            if photo_post_count >= 5:
                messages.error(request, "Limit reached: You can only have 5 photo posts on your account.")
                return redirect('home')
        if content:
            new_post = Post.objects.create(author=request.user, content=content, image=image)
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
    all_posts = Post.objects.filter(Q(is_hidden=False) | Q(author=request.user)).order_by('-created_at')
    return render(request, 'home.html', {'posts': all_posts})

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
            Notification.objects.create(
                recipient=target_profile.user, 
                sender=request.user, 
                notification_type='unfollow'
            )
        else:
            target_profile.followers.add(request.user.profile)
            Notification.objects.create(
                recipient=target_profile.user, 
                sender=request.user, 
                notification_type='follow'
            )
    return redirect('user_profile', username=username)

@login_required(login_url='login')
def toggle_like(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    if request.user in post.likes.all():
        post.likes.remove(request.user)
    else:
        post.likes.add(request.user)
        if request.user != post.author:
            Notification.objects.create(
                recipient=post.author, 
                sender=request.user, 
                notification_type='like',
                post=post
            )
        post.dislikes.remove(request.user)
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def toggle_dislike(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    if request.user in post.dislikes.all():
        post.dislikes.remove(request.user)
    else:
        post.dislikes.add(request.user)
        if request.user != post.author:
            Notification.objects.create(
                recipient=post.author, 
                sender=request.user, 
                notification_type='dislike',
                post=post
            )
        post.likes.remove(request.user)
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def postDetail(request, post_id):
    post = get_object_or_404(Post, id=post_id)
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
        'comments': all_comments
    })


@login_required(login_url='login')
def inbox(request):
    user_threads = request.user.threads.all().order_by('-updated_at')
    chat_data = []
    for thread in user_threads:
        last_message = thread.messages.order_by('-created_at').first()
        partner = None
        if not thread.is_group:
            partner = thread.participants.exclude(id=request.user.id).first()
            if not partner:
                partner = request.user
        
        chat_data.append({
            'thread': thread,
            'partner': partner,
            'last_message': last_message
        })
        
    return render(request, 'inbox.html', {'chat_data': chat_data})

@login_required(login_url='login')
def chat_thread(request, username):
    other_user = get_object_or_404(User, username=username)
    thread = request.user.threads.filter(is_group=False).filter(participants=other_user).first()
    if not thread:
        thread = Thread.objects.create(is_group=False)
        thread.participants.add(request.user, other_user)
    if request.method == 'POST':
        content = request.POST.get('content')
        if content:
            msg = Message.objects.create(thread=thread, sender=request.user, content=content)
            msg.read_by.add(request.user)
            thread.save()
            return redirect('chat_thread', username=username)
    messages = thread.messages.all()
    unread_messages = messages.exclude(read_by=request.user)
    for msg in unread_messages:
        msg.read_by.add(request.user)
    return render(request, 'messages.html', {
        'other_user': other_user, 
        'thread': thread,
        'messages': messages
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
    if request.user in comment.likes.all():
        comment.likes.remove(request.user)
    else:
        comment.likes.add(request.user)
        if request.user != comment.author:
            Notification.objects.create(
                recipient=comment.author, 
                sender=request.user, 
                notification_type='like',
                post=comment.post,    
                comment=comment
            )
        comment.dislikes.remove(request.user)
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required(login_url='login')
def toggle_comment_dislike(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    if request.user in comment.dislikes.all():
        comment.dislikes.remove(request.user)
    else:
        comment.dislikes.add(request.user)
        if request.user != comment.author:
            Notification.objects.create(
                recipient=comment.author, 
                sender=request.user, 
                notification_type='dislike',
                post=comment.post,
                comment=comment
            )
        comment.likes.remove(request.user)
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
            return redirect('chat_thread', thread_id=thread.id)
            
    return redirect('inbox')