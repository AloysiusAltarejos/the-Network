from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User
from django.db.models import Q, Count, Exists, OuterRef
from django.shortcuts import get_object_or_404
from .models import Profile, Post, Report, Notification, Comment, Message, Thread, ThreadNickname, Story, StoryView, User
import re, time, json, os
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache
from django.core.files.uploadedfile import UploadedFile
from django.views.decorators.csrf import csrf_exempt
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile
from django.db import IntegrityError
from functools import wraps

# --- Custom API Authentication Decorator ---
def api_login_required(view_func):
    """
    Custom decorator for React APIs.
    Returns a 401 JSON response instead of a 302 HTML redirect.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Unauthorized. Please log in.'}, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped_view


@csrf_exempt
@api_login_required
def api_submit_report(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            reason = data.get('reason', '')[:255] 
            target_type = data.get('type')
            target_id = data.get('id')

            report_kwargs = {'reporter': request.user, 'reason': reason}
            
            if target_type == 'user':
                target_user = User.objects.get(username=target_id)
                report_kwargs['reported_user'] = target_user
            elif target_type == 'post':
                report_kwargs['reported_post_id'] = target_id
            elif target_type == 'comment':
                report_kwargs['reported_comment_id'] = target_id
            else:
                return JsonResponse({'error': 'Invalid report type'}, status=400)

            Report.objects.create(**report_kwargs)
            return JsonResponse({'success': True})
            
        except IntegrityError:
            # (rejects request if database unique constraint is violated)
            return JsonResponse({'error': 'You have already reported this item.'}, status=403)
        except User.DoesNotExist:
            return JsonResponse({'error': 'User not found.'}, status=404)
        except Exception as e:
            return JsonResponse({'error': 'An error occurred.'}, status=500)
            
    return JsonResponse({'error': 'Invalid request'}, status=400)

@api_login_required
def api_get_network(request, username, network_type):
    target_user = get_object_or_404(User, username=username)
    target_profile = target_user.profile
    
    if network_type == 'followers':
        profiles = target_profile.followers.all()
    elif network_type == 'following':
        profiles = target_profile.following.all()
    else:
        return JsonResponse({'error': 'Invalid network type'}, status=400)
        
    users_data = []
    for prof in profiles:
        try:
            pic_url = prof.profile_picture.url if prof.profile_picture else None
        except ValueError:
            pic_url = None
            
        users_data.append({
            'id': prof.user.id,
            'username': prof.user.username,
            'name': prof.name if prof.name else prof.user.username,
            'profile_picture_url': pic_url,
            'profile_picture': pic_url 
        })
        
    return JsonResponse({'users': users_data})

@csrf_exempt
@api_login_required
def api_thread_settings(request, thread_id):
    thread = get_object_or_404(Thread, id=thread_id)
    
    if request.user not in thread.participants.all():
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    if request.method == 'POST':
        # (processes image uploads from form data)
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            action = request.POST.get('action')
            
            if action == 'change_picture' and thread.is_group:
                image = request.FILES.get('group_picture')
                if image:
                    if not _is_safe_image(image):
                        return JsonResponse({'error': 'Unsupported image format.'}, status=400)
                    
                    compressed_image = _compress_image(image)
                    
                    if thread.group_picture:
                        thread.group_picture.delete(save=False)
                        
                    file_name = f"group_{thread.id}_avatar.jpg"
                    thread.group_picture.save(file_name, compressed_image, save=True)
                    
                    return JsonResponse({'success': True})
                return JsonResponse({'error': 'No image provided.'}, status=400)
            return JsonResponse({'error': 'Invalid image upload action.'}, status=400)

        # (processes text actions from json payload)
        elif request.content_type == 'application/json':
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'mute':
                if request.user in thread.muted_by.all():
                    thread.muted_by.remove(request.user)
                    is_muted = False
                else:
                    thread.muted_by.add(request.user)
                    is_muted = True
                return JsonResponse({'success': True, 'is_muted': is_muted})
                
            elif action == 'change_nickname':
                target_user_id = data.get('target_user_id')
                new_nickname = data.get('nickname')
                target_user = get_object_or_404(User, id=target_user_id)
                
                nickname_obj, created = ThreadNickname.objects.get_or_create(
                    thread=thread, user=target_user, defaults={'nickname': new_nickname}
                )
                if not created:
                    nickname_obj.nickname = new_nickname
                    nickname_obj.save()
                
                # (creates system announcement message)
                Message.objects.create(
                    thread=thread,
                    sender=request.user,
                    content=f"{request.user.username} changed {target_user.username}'s nickname to {new_nickname}",
                    is_system=True
                )
                return JsonResponse({'success': True})
                
            elif action == 'change_name':
                if thread.is_group:
                    new_name = data.get('new_name')
                    thread.name = new_name
                    thread.save()
                    Message.objects.create(
                        thread=thread, sender=request.user, 
                        content=f"{request.user.username} changed the group name to {new_name}", 
                        is_system=True
                    )
                    return JsonResponse({'success': True})
                    
            elif action == 'add':
                if thread.is_group:
                    target_user = get_object_or_404(User, id=data.get('target_user_id'))
                    thread.participants.add(target_user)
                    Message.objects.create(
                        thread=thread, sender=request.user,
                        content=f"{request.user.username} added {target_user.username} to the group",
                        is_system=True
                    )
                    return JsonResponse({'success': True})
                    
            elif action == 'kick':
                if thread.is_group:
                    target_user = get_object_or_404(User, id=data.get('target_user_id'))
                    thread.participants.remove(target_user)
                    Message.objects.create(
                        thread=thread, sender=request.user,
                        content=f"{request.user.username} kicked {target_user.username} from the group",
                        is_system=True
                    )
                    return JsonResponse({'success': True})
                    
            elif action == 'delete_me':
                thread.participants.remove(request.user)
                if thread.is_group:
                    Message.objects.create(
                        thread=thread, sender=request.user,
                        content=f"{request.user.username} left the group", is_system=True
                    )
                if thread.participants.count() == 0:
                    thread.delete()
                return JsonResponse({'success': True})
                
            elif action == 'delete_both':
                thread.delete()
                return JsonResponse({'success': True})
                
    # (provides fallback for non-post requests)
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
@api_login_required
def api_create_group(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        
        # (maps user ids from group modal)
        participant_ids = data.get('user_ids', [])
        
        # (sets group name from modal input)
        group_name = data.get('group_name', 'New Group Chat')
        
        new_group = Thread.objects.create(is_group=True, name=group_name)
        new_group.participants.add(request.user)
        
        for user_id in participant_ids:
            try:
                user_to_add = User.objects.get(id=user_id)
                new_group.participants.add(user_to_add)
            except User.DoesNotExist:
                pass
                
        return JsonResponse({'success': True, 'thread_id': new_group.id})
        
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
@api_login_required
@require_POST
def api_follow_user(request, username):
    target_user = get_object_or_404(User, username=username)
    
    if target_user == request.user:
        return JsonResponse({'error': 'Cannot follow yourself'}, status=400)
        
    target_profile = target_user.profile
    my_profile = request.user.profile
    
    is_following = my_profile in target_profile.followers.all()
    
    if is_following:
        target_profile.followers.remove(my_profile)
        try:
            Notification.objects.filter(
                recipient=target_user, 
                sender=request.user, 
                notification_type='follow'
            ).delete()
        except Exception:
            pass
    else:
        target_profile.followers.add(my_profile)
        try:
            Notification.objects.get_or_create(
                recipient=target_user, 
                sender=request.user, 
                notification_type='follow'
            )
        except Exception:
            pass
            
    return JsonResponse({
        'status': 'success', 
        'is_following': not is_following, 
        'followers_count': target_profile.followers.count()
    })

@api_login_required
def api_users(request):
    users = User.objects.exclude(id=request.user.id).select_related('profile')
    users_data = []
    
    for person in users:
        pic_url = person.profile.profile_picture.url if hasattr(person, 'profile') and person.profile.profile_picture else None
        
        users_data.append({
            'id': person.id,
            'username': person.username,
            'name': person.profile.name if hasattr(person, 'profile') and person.profile.name else person.username,
            'profile_picture': pic_url
        })
        
    return JsonResponse(users_data, safe=False)

@csrf_exempt
@api_login_required
@require_POST
def api_start_chat(request, username):
    target_user = get_object_or_404(User, username=username)
    if target_user == request.user:
        return JsonResponse({'error': 'Cannot chat with yourself'}, status=400)
    
    threads = Thread.objects.filter(is_group=False, participants=request.user).filter(participants=target_user)
    if threads.exists():
        thread = threads.first()
    else:
        thread = Thread.objects.create(is_group=False)
        thread.participants.add(request.user, target_user)
        
    return JsonResponse({'thread_id': thread.id})

@csrf_exempt
@api_login_required
def api_inbox(request):
    user = request.user
    threads = Thread.objects.filter(participants=user).distinct()
    chat_data = []
    
    for thread in threads:
        thread_messages = Message.objects.filter(thread=thread).order_by('-created_at')
        last_message = thread_messages.first()
        
        try:
           unread_count = thread_messages.exclude(sender=user).exclude(read_by=user).count()
        except Exception as e:
            print(f"Error calculating unread count: {e}")
            unread_count = 0 
            
        partner = thread.participants.exclude(id=user.id).first() if not thread.is_group else None
        
        # (defines mute status before dictionary append)
        try:
            is_muted = user in thread.muted_by.all()
        except Exception:
            is_muted = False
            
        nicknames = {tn.user_id: tn.nickname for tn in ThreadNickname.objects.filter(thread=thread)}
            
        # (appends thread data once to prevent duplicates)
        chat_data.append({
            'thread': {
                'id': thread.id,
                'name': getattr(thread, 'name', None) if thread.is_group else None,
                'is_group': thread.is_group,
                'group_picture': thread.group_picture.url if thread.is_group and getattr(thread, 'group_picture', None) else None,
                'is_muted': is_muted,
            },
            'partner': {
                'username': partner.username,
                'name': nicknames.get(partner.id, partner.profile.name if hasattr(partner, 'profile') and partner.profile.name else partner.username),
                'profile_picture': partner.profile.profile_picture.url if hasattr(partner, 'profile') and partner.profile.profile_picture else None,
            } if partner else None,
            'last_message': {
                'content': last_message.content,
                'sender_username': last_message.sender.username,
                'sender_name': nicknames.get(last_message.sender.id, last_message.sender.profile.name if hasattr(last_message.sender, 'profile') and last_message.sender.profile.name else last_message.sender.username),
                'is_me': last_message.sender == user,
                'created_at': last_message.created_at.isoformat(), 
                'seen_by': [nicknames.get(u.id, u.username) for u in last_message.read_by.exclude(id=last_message.sender.id)] if last_message else []
            } if last_message else None,
            'unread_count': unread_count
        })
        
    return JsonResponse({'chat_data': chat_data})

@csrf_exempt
@api_login_required
def api_thread(request, thread_id):
    thread = Thread.objects.get(id=thread_id) 
    
    if request.method == 'POST':
        data = json.loads(request.body)
        content = data.get('content')
        
        if content:
            new_message = Message.objects.create(
                thread=thread,
                sender=request.user,
                content=content
            )
            return JsonResponse({'status': 'success', 'message_id': new_message.id})
        return JsonResponse({'error': 'Message content required'}, status=400)
    
    messages = thread.messages.order_by('created_at')

    last_msg = messages.last()
    if last_msg and request.user != last_msg.sender:
        last_msg.read_by.add(request.user)
    messages_data = []
    
    # (gets nicknames for current thread)
    nicknames = {tn.user_id: tn.nickname for tn in ThreadNickname.objects.filter(thread=thread)}
    
    for msg in messages:
        messages_data.append({
            'id': msg.id,
            'content': msg.content,
            'is_system': getattr(msg, 'is_system', False),
            'sender_username': msg.sender.username,
            # (formats sender display name using nickname)
            'sender_display_name': nicknames.get(msg.sender.id, msg.sender.username), 
            'sender_pic': msg.sender.profile.profile_picture.url if msg.sender.profile.profile_picture else None,
            'is_me': msg.sender == request.user,
            'created_at': msg.created_at.isoformat(),
        })

        if msg == last_msg:
            seen_users = msg.read_by.exclude(id=msg.sender.id)
            msg_data['seen_by'] = [nicknames.get(u.id, u.username) for u in seen_users]
            
        messages_data.append(msg_data)

    participants_data = []
    for p in thread.participants.all():
        participants_data.append({
            'id': p.id,
            'username': p.username,
            # (prefills nickname in settings modal)
            'nickname': nicknames.get(p.id, '') 
        })

    partner = thread.participants.exclude(id=request.user.id).first() if not thread.is_group else None
        
    return JsonResponse({
        'thread': {
            'id': thread.id,
            'is_group': thread.is_group,
            'name': thread.name,
            'participant_count': thread.participants.count(),
            'participants': participants_data,
            'group_picture': thread.group_picture.url if thread.is_group and thread.group_picture else None,
            # (formats chat header name using nickname)
            'partner_name': nicknames.get(partner.id, partner.profile.name if partner and partner.profile.name else (partner.username if partner else None)) if partner else None,
            'partner_pic': partner.profile.profile_picture.url if partner and partner.profile.profile_picture else None,
            'partner_username': partner.username if partner else None,
            # (sets mute button toggle state)
            'is_muted': request.user in thread.muted_by.all(), 
        },
        'messages': messages_data
    })

@csrf_exempt
@api_login_required
def api_story_limits(request):
    now = timezone.now()
    yesterday = now - timedelta(hours=24)
    
    recent_stories = Story.objects.filter(author=request.user, created_at__gte=yesterday, is_deleted=False)
    
    text_count = recent_stories.filter(Q(image__exact='') | Q(image__isnull=True)).count()
    photo_count = recent_stories.count() - text_count
    
    return JsonResponse({
        'photos_left': max(0, 5 - photo_count),
        'text_left': max(0, 5 - text_count)
    })

@api_login_required
def api_comment_action(request, pk, action):
    comment = get_object_or_404(Comment, pk=pk)

    if action == 'delete':
        if comment.author == request.user:
            comment.delete()
            return JsonResponse({'status': 'deleted'})
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    if action == 'like':
        if request.user in comment.likes.all():
            comment.likes.remove(request.user)
            Notification.objects.filter(recipient=comment.author, sender=request.user, notification_type='like', comment=comment).delete()
        else:
            comment.likes.add(request.user)
            comment.dislikes.remove(request.user) 
            Notification.objects.filter(recipient=comment.author, sender=request.user, notification_type='dislike', comment=comment).delete()
            if request.user != comment.author:
                Notification.objects.create(recipient=comment.author, sender=request.user, notification_type='like', comment=comment, post=comment.post)
            
    elif action == 'dislike':
        if request.user in comment.dislikes.all():
            comment.dislikes.remove(request.user)
            Notification.objects.filter(recipient=comment.author, sender=request.user, notification_type='dislike', comment=comment).delete()
        else:
            comment.dislikes.add(request.user)
            comment.likes.remove(request.user)
            Notification.objects.filter(recipient=comment.author, sender=request.user, notification_type='like', comment=comment).delete()
            
            # (creates dislike notification)
            if request.user != comment.author:
                Notification.objects.create(recipient=comment.author, sender=request.user, notification_type='dislike', comment=comment, post=comment.post)
            
    return JsonResponse({
        'likes': comment.likes.count(),
        'dislikes': comment.dislikes.count()
    })

@api_login_required
def api_notifications(request):
    notifications = Notification.objects.filter(recipient=request.user).order_by('-created_at')[:15]
    notif_data = []
    
    for n in notifications:
        action_text = "interacted with you"
        
        # (generates specific notification text based on type)
        if n.notification_type == 'like':
            if n.story:
                action_text = "liked your story"
            elif n.comment:
                action_text = "liked your reply"
            else:
                action_text = "liked your post"

        elif n.notification_type == 'dislike':
            if n.comment:
                action_text = "disliked your reply"
            else:
                action_text = "disliked your post"
                
        elif n.notification_type == 'comment':
            if n.story:
                action_text = "replied to your story"
            # (formats text for reply to a reply)
            elif n.comment and n.comment.parent: 
                action_text = "replied to your reply"
            else:
                action_text = "replied to your post"
                
        elif n.notification_type == 'follow':
            action_text = "started following you"
            
        notif_data.append({
            'id': n.id,
            'sender_username': n.sender.username,
            'sender_pic': n.sender.profile.profile_picture.url if n.sender.profile.profile_picture else None,
            'action_text': action_text,
            'type': n.notification_type,
            'date': n.created_at.isoformat(),
            'post_id': n.post.id if n.post else None,
            'story_id': n.story.id if n.story else None,  
            'comment_id': n.comment.id if n.comment else None, 
            'is_read': getattr(n, 'is_read', False), 
            'unread_message_count': request.user.profile.unread_message_count
        })
        
    return JsonResponse({
        'notifications': notif_data,
        'unread_message_count': request.user.profile.unread_message_count
    })

# (handles notification read status)
@csrf_exempt
@api_login_required
@require_POST
def api_mark_notification_read(request, notif_id):
    notif = get_object_or_404(Notification, id=notif_id, recipient=request.user)
    notif.is_read = True
    notif.save()
    return JsonResponse({'success': True})

@csrf_exempt
@api_login_required
@require_POST
def api_delete_notification(request, notif_id):
    # (restricts deletion to own notifications)
    notif = get_object_or_404(Notification, id=notif_id, recipient=request.user)
    notif.delete()
    return JsonResponse({'success': True})

@csrf_exempt
@api_login_required
@require_POST
def api_clear_all_notifications(request):
    Notification.objects.filter(recipient=request.user).delete()
    return JsonResponse({'success': True})

@api_login_required
def api_post_detail(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    
    post_data = {
        'id': post.id,
        'content': post.content,
        'author_username': post.author.username,
        'author_name': post.author.profile.name if post.author.profile.name else post.author.username,
        # (formats post date as iso string)
        'smart_date': post.created_at.isoformat(), 
        'profile_picture_url': post.author.profile.profile_picture.url if post.author.profile.profile_picture else None,
        'image_url': post.image.url if post.image else None,
        'likes': post.likes.count(),
        'dislikes': post.dislikes.count(),
        'has_liked': request.user in post.likes.all(),
        'has_disliked': request.user in post.dislikes.all(),
        'followers_only': post.followers_only
    }
    
    comments_data = []
    all_comments = list(post.comments.all().order_by('created_at'))
    comment_indices = {comment.id: idx for idx, comment in enumerate(all_comments, start=1)}
    
    for comment in all_comments:
        comments_data.append({
            'id': comment.id,
            'post_id': post.id,
            'author_username': comment.author.username,
            'author_name': comment.author.profile.name if comment.author.profile.name else comment.author.username,
            'profile_picture_url': comment.author.profile.profile_picture.url if comment.author.profile.profile_picture else None,
            'content': comment.content,
            # (formats comment date as iso string)
            'smart_date': comment.created_at.isoformat(), 
            'likes': comment.likes.count(),
            'dislikes': comment.dislikes.count(),
            'has_liked': request.user in comment.likes.all(),
            'has_disliked': request.user in comment.dislikes.all(),
            'is_author': request.user == comment.author,
            'thread_index': comment_indices[comment.id],
            'parent_index': comment_indices.get(comment.parent_id) if comment.parent_id else None
        })
        
    return JsonResponse({
        'post': post_data,
        'comments': comments_data
    })

@csrf_exempt
@api_login_required
def api_post_reply(request, post_id):
    if request.method == 'POST':
        post = get_object_or_404(Post, id=post_id)
        content = request.POST.get('content')
        parent_id = request.POST.get('parent_id')
        
        if content:
            parent_comment = None
            if parent_id:
                # (verifies parent comment belongs to the post)
                parent_comment = get_object_or_404(Comment, id=parent_id, post=post)
                
            new_comment = Comment.objects.create(
                post=post, 
                author=request.user, 
                content=content,
                parent=parent_comment
            )
            
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
                
            return JsonResponse({'status': 'success', 'message': 'Reply added'})
            
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt 
@api_login_required
def api_update_profile(request):
    profile, created = Profile.objects.get_or_create(user=request.user)
    
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            field = data.get('field')
            value = data.get('value')
            
            if field == 'email':
                request.user.email = value
                request.user.save()
            elif field in ['name', 'pronouns', 'location', 'bio']:
                setattr(profile, field, value)
                profile.save()
                
            return JsonResponse({'status': 'success', 'field': field, 'value': value})
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
            
    elif request.method == 'POST':
        field = request.POST.get('field')
        
        if field == 'profile_picture' and request.FILES.get('image_upload'):
            now = time.time()
            pfp_history = request.session.get('pfp_history', [])
            pfp_history = [t for t in pfp_history if now - t < 86400]
            
            if len(pfp_history) >= 2:
                return JsonResponse({'error': 'You can only change your profile picture 2 times a day.'}, status=400)
            
            if profile.profile_picture:
                profile.profile_picture.delete(save=False)
            
            uploaded_image = request.FILES['image_upload']
            
            try:
                if not _is_safe_image(uploaded_image):
                    return JsonResponse({'error': 'Unsupported image format.'}, status=400)
                
                compressed_image = _compress_image(request.FILES['image_upload'])
                file_name = f"{request.user.username}_avatar.jpg"
                
                if profile.profile_picture:
                    profile.profile_picture.delete(save=False)

                profile.profile_picture.save(file_name, compressed_image, save=True)

                pfp_history.append(now)
                request.session['pfp_history'] = pfp_history
                
                return JsonResponse({
                    'status': 'success', 
                    'new_image_url': profile.profile_picture.url
                })
                
            except Exception as e:
                print(f"Profile Picture Upload Error: {e}")
                return JsonResponse({'error': 'Failed to process image on the server.'}, status=500)
            
        elif field == 'remove_picture':
            if profile.profile_picture:
                profile.profile_picture.delete(save=False) 
            profile.profile_picture = None
            profile.save()
            return JsonResponse({'status': 'success', 'message': 'Picture removed'})

    return JsonResponse({'error': 'Invalid request'}, status=400)

@api_login_required
def api_search_view(request):
    query = request.GET.get('q', '')
    results_data = []
    
    if query:
        users = User.objects.filter(
            Q(username__icontains=query) | Q(profile__name__icontains=query)
        ).distinct()
        
        for person in users:
            pic_url = person.profile.profile_picture.url if person.profile.profile_picture else None
            results_data.append({
                'username': person.username,
                'name': person.profile.name if person.profile.name else person.username,
                'profile_picture_url': pic_url
            })
            
    return JsonResponse({'results': results_data})


@api_login_required
def api_profile_view(request, username=None):
    if username:
        target_user = get_object_or_404(User, username=username)
    else:
        target_user = request.user
        
    target_profile = target_user.profile 
    pic_url = target_profile.profile_picture.url if target_profile.profile_picture else None
    
    is_following = False
    if request.user.is_authenticated and request.user != target_user:
        is_following = request.user.profile in target_profile.followers.all()
    
    profile_data = {
        'username': target_user.username,
        'name': target_profile.name,
        'email': target_user.email,
        'pronouns': target_profile.pronouns,
        'location': target_profile.location,
        'bio': target_profile.bio,
        'profile_picture': pic_url,
        'followers_count': target_profile.followers.count(),
        'following_count': target_user.profile.following.count(),
        'is_following': is_following,  
    }

    return JsonResponse({
        'profile': profile_data,
        'is_current_user': request.user == target_user
    })


@api_login_required
def api_profile_feed(request, username=None):
    if username:
        target_user = get_object_or_404(User, username=username)
    else:
        target_user = request.user
        
    current_tab = request.GET.get('tab', 'posts')
    
    if current_tab == 'liked':
        posts = list(Post.objects.filter(likes=target_user))
        comments = list(Comment.objects.filter(likes=target_user))
        items_list = sorted(posts + comments, key=lambda x: x.created_at, reverse=True)
    elif current_tab == 'disliked':
        posts = list(Post.objects.filter(dislikes=target_user))
        comments = list(Comment.objects.filter(dislikes=target_user))
        items_list = sorted(posts + comments, key=lambda x: x.created_at, reverse=True)
    elif current_tab == 'replies':
        items_list = Comment.objects.filter(author=target_user).order_by('-created_at')
    else:
        items_list = Post.objects.filter(author=target_user).order_by('-created_at')

    paginator = Paginator(items_list, 10) 
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    
    feed_data = []
    for item in page_obj:
        if hasattr(item, 'post'): 
            feed_data.append({
                'id': item.id,
                'post_id': item.post.id, 
                'content': item.content,
                'author_username': item.author.username,
                'target_username': item.post.author.username, 
                'smart_date': item.created_at.strftime('%b %d, %Y'),
            })
        else:
            feed_data.append({
                'id': item.id,
                'content': item.content,
                'author_username': item.author.username,
                'smart_date': item.smart_date,
                'image_url': item.image.url if item.image else None,
                'followers_only': item.followers_only,
            })
            
    return JsonResponse({
        'items': feed_data,
        'has_next': page_obj.has_next(),
    })


@csrf_exempt 
def api_register_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')
            password_conf = data.get('passwordConfirmation')
            
            if not username or not password:
                return JsonResponse({'error': 'Username and password are required'}, status=400)
                
            if password != password_conf:
                return JsonResponse({'error': 'Passwords do not match'}, status=400)
            
            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Username is already taken'}, status=400)
            
            user = User.objects.create_user(username=username, email=email, password=password)
            profile, created = Profile.objects.get_or_create(user=user)
            profile.pronouns = data.get('pronouns', '')
            profile.bio = data.get('bio', '')
            profile.location = data.get('location', '')
            profile.save()
            
            login(request, user)
            return JsonResponse({'message': 'Registration successful'}, status=201)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
def api_login_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return JsonResponse({'message': 'Login successful'})
            else:
                return JsonResponse({'error': 'Invalid credentials'}, status=401)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON payload'}, status=400)
            
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt 
def api_logout_view(request):
    if request.method == 'POST':
        logout(request)
        return JsonResponse({'status': 'success'})
    return JsonResponse({'error': 'Invalid request method'}, status=405)


@csrf_exempt 
@api_login_required
def api_post_action(request, post_id, action):
    if request.method == 'POST':
        post = Post.objects.filter(id=post_id).first()
        if not post:
            return JsonResponse({'error': 'Post not found'}, status=404)
        if action == 'delete':
            if post.author == request.user:
                post.delete()
                return JsonResponse({'status': 'deleted'})
            return JsonResponse({'error': 'Unauthorized'}, status=403)
        if action == 'like':
            if request.user in post.likes.all():
                post.likes.remove(request.user)
                Notification.objects.filter(recipient=post.author, sender=request.user, notification_type='like', post=post).delete()
            else:
                post.likes.add(request.user)
                post.dislikes.remove(request.user)
                # (removes existing dislike notification)
                Notification.objects.filter(recipient=post.author, sender=request.user, notification_type='dislike', post=post).delete() 
                if request.user != post.author:
                    Notification.objects.create(recipient=post.author, sender=request.user, notification_type='like', post=post)
                    
        elif action == 'dislike':
            if request.user in post.dislikes.all():
                post.dislikes.remove(request.user)
                # (removes dislike notification)
                Notification.objects.filter(recipient=post.author, sender=request.user, notification_type='dislike', post=post).delete()
            else:
                post.dislikes.add(request.user)
                post.likes.remove(request.user) 
                # (removes existing like notification)
                Notification.objects.filter(recipient=post.author, sender=request.user, notification_type='like', post=post).delete()
                
                # (creates dislike notification)
                if request.user != post.author:
                    Notification.objects.create(recipient=post.author, sender=request.user, notification_type='dislike', post=post)

        return JsonResponse({
            'likes': post.likes.count(),
            'dislikes': post.dislikes.count(),
            'has_liked': request.user in post.likes.all(),
            'has_disliked': request.user in post.dislikes.all()
        })
        
    return JsonResponse({'error': 'Invalid request'}, status=400)


@csrf_exempt
@api_login_required
def api_add_story(request):
    if request.method == 'POST':
        now = timezone.now()
        yesterday = now - timedelta(hours=24)

        recent_stories = Story.objects.filter(author=request.user, created_at__gte=yesterday, is_deleted=False)
        
        text_stories_count = recent_stories.filter(Q(image__exact='') | Q(image__isnull=True)).count()
        photo_stories_count = recent_stories.count() - text_stories_count

        is_uploading_photo = bool(request.FILES.get('image'))

        if is_uploading_photo and photo_stories_count >= 5:
            return JsonResponse({'error': 'You can only post 5 photo stories per 24 hours.'}, status=403)
        elif not is_uploading_photo and text_stories_count >= 5:
            return JsonResponse({'error': 'You can only post 5 text stories per 24 hours.'}, status=403)
        
        text_content = request.POST.get('text_content', '')
        visibility = request.POST.get('visibility', 'public')
        image = request.FILES.get('image', None)

        if image:
            if not _is_safe_image(image):
                 return JsonResponse({'error': 'Unsupported image format.'}, status=400)
            image = _compress_image(image)

        story = Story.objects.create(
            author=request.user,
            text_content=text_content,
            visibility=visibility,
            image=image 
        )

        if visibility == 'custom':
            allowed_users_json = request.POST.get('allowed_users', '[]')
            try:
                allowed_user_ids = json.loads(allowed_users_json)
                if allowed_user_ids:
                    story.allowed_users.set(allowed_user_ids)
            except json.JSONDecodeError:
                pass
        
        return JsonResponse({'message': 'Story created successfully!', 'id': story.id}, status=201)

    return JsonResponse({'error': 'Invalid request method'}, status=400)

@api_login_required
def api_suggested(request):
    my_profile = request.user.profile
    # (evaluates queryset to list to prevent database subquery failures)
    my_following_ids = list(my_profile.following.values_list('id', flat=True))

    mutuals = Profile.objects.filter(
        followers__in=my_following_ids
    ).exclude(
        id=my_profile.id
    ).exclude(
        id__in=my_following_ids
    ).annotate(
        mutual_count=Count('followers')
    ).order_by('-mutual_count')[:5]
    
    # (filters for users who joined within the last 7 days)
    one_week_ago = timezone.now() - timedelta(days=7)
    new_users = Profile.objects.filter(
        user__date_joined__gte=one_week_ago
    ).exclude(
        id=my_profile.id
    ).exclude(
        id__in=my_following_ids
    ).order_by('-user__date_joined')[:5]
    
    suggested_profiles = list(mutuals)
    for profile in new_users:
        if profile not in suggested_profiles:
            suggested_profiles.append(profile)
        if len(suggested_profiles) >= 5:
            break

    suggested_data = []
    for prof in suggested_profiles:
        try:
            pic_url = prof.profile_picture.url if prof.profile_picture else ''
        except ValueError:
            pic_url = ''
            
        suggested_data.append({
            'username': prof.user.username,
            'name': prof.name if prof.name else prof.user.username,
            'pic_url': pic_url
        })

    return JsonResponse({'suggested': suggested_data})

@api_login_required
def api_stories(request):
    time_threshold = timezone.now() - timedelta(hours=24)
    
    # (queries custom visibility allowed users)
    active_stories = Story.objects.filter(
        Q(created_at__gte=time_threshold) & Q(is_deleted=False) &
        (   
            Q(author=request.user) |
            Q(visibility='public') |
            Q(visibility='followers', author__profile__followers=request.user.profile) |
            Q(visibility='custom', allowed_users=request.user)
        )
    ).select_related(
        'author', 'author__profile'
    ).prefetch_related(
        'story_views__viewer__profile', 'likes'
    ).distinct().order_by('author', 'created_at')

    stories_data = {}
    for story in active_stories:
        uname = story.author.username
        if uname not in stories_data:
            try:
                pic_url = story.author.profile.profile_picture.url if story.author.profile.profile_picture else ''
            except ValueError:
                pic_url = ''

            stories_data[uname] = {
                'username': uname,
                'name': story.author.profile.name if story.author.profile.name else uname,
                'pic_url': pic_url,
                'items': []
            }
        
        stories_data[uname]['items'].append({
            'id': story.id,
            'image_url': story.image.url if story.image else None,
            'text_content': story.text_content,
            'visibility': story.visibility,
            'created_at': story.created_at.isoformat(),
            'viewed': story.story_views.filter(viewer=request.user).exists(),
            'is_liked': story.likes.filter(id=request.user.id).exists(),
            'is_mine': story.author == request.user, 
           'views': [
                {
                    'username': sv.viewer.username,
                    'name': sv.viewer.profile.name if sv.viewer.profile.name else sv.viewer.username,
                    'profile_picture_url': sv.viewer.profile.profile_picture.url if sv.viewer.profile.profile_picture else None,
                    # (flags if viewer liked story)
                    'liked': sv.viewer in story.likes.all() 
                # (orders views newest first)
                } for sv in story.story_views.all().order_by('-viewed_at') 
            ] if request.user == story.author else []
        })

    return JsonResponse({'stories': list(stories_data.values())})

@csrf_exempt
@require_POST
@api_login_required
def api_create_post(request):
    content = request.POST.get('content')
    visibility = request.POST.get('visibility') 
    is_followers_only = (visibility == 'followers')
    image = request.FILES.get('image')

    if image:
        if not _is_safe_image(image):
            return JsonResponse({'error': 'Unsupported or oversized image upload.'}, status=400)
        
        image = _compress_image(image)
        
        photo_post_count = Post.objects.filter(
            author=request.user, 
            image__isnull=False
        ).exclude(image='').count()
        
        if photo_post_count >= 10:
            return JsonResponse({'error': 'Limit reached.'}, status=400)
            
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

    return JsonResponse({
        'id': new_post.id,
        'content': new_post.content,
        'author_username': new_post.author.username,
        'author_name': new_post.author.profile.name if new_post.author.profile.name else new_post.author.username,
        'smart_date': new_post.smart_date,
        'likes': 0,
        'dislikes': 0,
        'image_url': new_post.image.url if new_post.image else None,
        'followers_only': new_post.followers_only,
        'profile_picture_url': new_post.author.profile.profile_picture.url if new_post.author.profile.profile_picture else None
    }, status=201)

@api_login_required
def api_home_view(request):
    feed_type = request.GET.get('feed', 'global')
    
    # (joins author and profile for feed query)
    base_qs = Post.objects.select_related('author', 'author__profile')
    
    # (filters feed by following preference)
    if feed_type == 'following':
        following_users = request.user.profile.following.values_list('user_id', flat=True)
        post_list = base_qs.filter(Q(author_id__in=following_users) | Q(author=request.user)).distinct()
    else:
        post_list = base_qs.filter(followers_only=False)

    # (aggregates counts in database layer)
    # (checks user interactions using exists subquery)
    user_liked = Post.likes.through.objects.filter(post_id=OuterRef('pk'), user_id=request.user.id)
    user_disliked = Post.dislikes.through.objects.filter(post_id=OuterRef('pk'), user_id=request.user.id)

    post_list = post_list.annotate(
        like_count=Count('likes', distinct=True),
        dislike_count=Count('dislikes', distinct=True),
        comments_count=Count('comments', distinct=True),
        user_has_liked=Exists(user_liked),
        user_has_disliked=Exists(user_disliked)
    ).order_by('-created_at')

    paginator = Paginator(post_list, 15)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)

    posts_data = []
    for post in page_obj:
        posts_data.append({
            'id': post.id,
            'content': post.content,
            'author_username': post.author.username,
            'author_name': post.author.profile.name if post.author.profile.name else post.author.username,
            'smart_date': post.smart_date,
            'likes': post.like_count,          # (maps annotated database value)
            'dislikes': post.dislike_count,    # (maps annotated database value)
            'comments_count': post.comments_count, # (maps annotated database value)
            'has_liked': post.user_has_liked,  # (maps annotated database boolean)
            'has_disliked': post.user_has_disliked, # (maps annotated database boolean)
            'is_author': request.user == post.author,
            'image_url': post.image.url if post.image else None,
            'followers_only': post.followers_only,
            'profile_picture_url': post.author.profile.profile_picture.url if post.author.profile.profile_picture else None
        })

    return JsonResponse({
        'posts': posts_data,
        'current_feed': feed_type,
        'has_next': page_obj.has_next()
    })

@csrf_exempt
@api_login_required
def delete_account(request):
    if request.method == 'POST':
        user_to_delete = request.user

        Thread.objects.filter(participants=user_to_delete, is_group=False).delete()

        ghost_user, created = User.objects.get_or_create(
            username='deleted account',
            defaults={'is_active': False}
        )

        Message.objects.filter(sender=user_to_delete, thread__is_group=True).update(sender=ghost_user)

        user_to_delete.delete()
        logout(request)
        
        return JsonResponse({'status': 'success'})
        
    return JsonResponse({'error': 'Invalid request'}, status=400)


@api_login_required
@require_POST
def mark_story_viewed(request, story_id):
    story = get_object_or_404(Story, id=story_id)
    if story.author != request.user:
        # (fetches or creates story view record)
        view_record, created = StoryView.objects.get_or_create(story=story, viewer=request.user)
        # (updates timestamp for repeat views)
        if not created:
            view_record.viewed_at = timezone.now()
            view_record.save()
    return JsonResponse({'status': 'success'})

@api_login_required
@require_POST
def delete_story(request, story_id):
    story = get_object_or_404(Story, id=story_id, author=request.user)
    story.is_deleted = True 
    story.save()
    return JsonResponse({'message': 'Story deleted'})

@api_login_required
def get_story_viewers(request, story_id):
    story = get_object_or_404(Story, id=story_id)
    if story.author != request.user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    # (references correct story views model)
    viewers = story.story_views.all().order_by('-viewed_at').select_related('viewer', 'viewer__profile')
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

@api_login_required
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

@api_login_required
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

def _compress_image(image_file, max_size=1048576, max_dimension=(1200, 1200)):
    try:
        img = Image.open(image_file)
        
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        # (resizes image bounding box without cropping)
        img.thumbnail(max_dimension, Image.Resampling.LANCZOS)

        output = BytesIO()
        # (compresses image to reduce file size)
        img.save(output, format='JPEG', quality=75, optimize=True)
        
        original_name = getattr(image_file, 'name', 'image.jpg')
        file_name = os.path.splitext(original_name)[0] + '.jpg'
        
        return ContentFile(output.getvalue(), name=file_name)
    except Exception as e:
        print(f"Image compression failed: {e}")
        return image_file