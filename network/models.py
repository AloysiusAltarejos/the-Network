#ALWAYS PYTHON MANAGE.PY MAKEMIGRATIONS AND THEN PYTHON MANAGE.PY MIGRATE AFTER MAKING CHANGES TO MODELS.PY I HATE MIGRATION ISSUES SO MUCH!!!!!
from django.db import models
from django.contrib.auth.models import User
from django.core.files.uploadedfile import InMemoryUploadedFile
from numpy import diff
from PIL import Image
from django.utils import timezone
import io, sys
from datetime import timedelta

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, blank=True)
    pronouns = models.CharField(max_length=50, blank=True)
    location = models.CharField(max_length=100, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    followers = models.ManyToManyField('self', symmetrical=False, related_name='following', blank=True)
    
    def __str__(self):
        return f"{self.user.username}'s Profile"
    def save(self, *args, **kwargs):
        if self.profile_picture and getattr(self.profile_picture, 'file', None):
            if self.profile_picture.size > 1048576:
                self.profile_picture = compress_to_1mb(self.profile_picture)
        super().save(*args, **kwargs)
    @property
    def unread_message_count(self):
        from .models import Message
        return Message.objects.filter(
            thread__participants=self.user
        ).exclude(
            sender=self.user
        ).exclude(
            read_by=self.user
        ).exclude(
            thread__muted_by=self.user
        ).count()

class Post(models.Model):
    #authors details
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(max_length=280)
    created_at = models.DateTimeField(auto_now_add=True)
    
    #interactiions
    likes = models.ManyToManyField(User, related_name='liked_posts', blank=True)
    dislikes = models.ManyToManyField(User, related_name='disliked_posts', blank=True)
    
    #image
    image = models.ImageField(upload_to='post_images/', blank=True, null=True)
    def save(self, *args, **kwargs):
        if self.image and getattr(self.image, 'file', None):
            if self.image.size > 1048576:
                self.image = compress_to_1mb(self.image)
        super().save(*args, **kwargs)

    #extra post details
    is_hidden = models.BooleanField(default=False)
    followers_only = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at'] 
    @property
    def smart_date(self):
        now = timezone.now()
        diff = now - self.created_at
        if self.created_at.year < now.year:
            return self.created_at.strftime('%m/%d/%Y')
        elif diff.days >= 28:
            return self.created_at.strftime('%m/%d')
        elif diff.days > 0:
            return f"{diff.days}d"
        elif diff.seconds >= 3600:
            hours = diff.seconds // 3600
            return f"{hours}h"
        elif diff.seconds >= 60:
            minutes = diff.seconds // 60
            return f"{minutes}m"
        else:
            return "Now"
    def __str__(self):
        return f"Post by {self.author.username} at {self.created_at}"
    
class Report(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reports')
    comment = models.ForeignKey('Comment', on_delete=models.CASCADE, related_name='reports', null=True, blank=True)
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report on {self.post.author.username}'s post by {self.reported_by.username}"

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('follow', 'Follow'),
        ('unfollow', 'Unfollow'),
        ('comment', 'Comment'),
        ('like', 'Like'),
        ('dislike', 'Dislike'),
        ('tag', 'Tag'),
    )
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_notifications')
    post = models.ForeignKey(Post, null=True, blank=True, on_delete=models.CASCADE)
    comment = models.ForeignKey('Comment', null=True, blank=True, on_delete=models.CASCADE)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    story = models.ForeignKey('Story', null=True, blank=True, on_delete=models.CASCADE)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    is_hidden = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at'] 
    def __str__(self):
        return f"{self.sender.username} -> {self.recipient.username} ({self.notification_type})"
    
class Comment(models.Model):
    post = models.ForeignKey(Post, related_name='comments', on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    likes = models.ManyToManyField(User, related_name='liked_comments', blank=True)
    dislikes = models.ManyToManyField(User, related_name='disliked_comments', blank=True)
    is_hidden = models.BooleanField(default=False)
    class Meta:
        ordering = ['created_at']
    def __str__(self):
        return f"Reply by {self.author.username} on Post {self.post.id}"
    
class Thread(models.Model):
    participants = models.ManyToManyField(User, related_name='threads')
    is_group = models.BooleanField(default=False)
    name = models.CharField(max_length=100, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    muted_by = models.ManyToManyField(User, related_name='muted_threads', blank=True)
    deleted_by = models.ManyToManyField(User, related_name='deleted_threads', blank=True)
    group_picture = models.ImageField(upload_to='group_pics/', blank=True, null=True)

    def __str__(self):
        return self.name if self.is_group else f"Thread {self.id}"
    def save(self, *args, **kwargs):
        if self.group_picture and getattr(self.group_picture, 'file', None):
            if self.group_picture.size > 1048576:
                self.group_picture = compress_to_1mb(self.group_picture)
        super().save(*args, **kwargs)

class Message(models.Model):
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(max_length=1000)
    read_by = models.ManyToManyField(User, related_name='read_messages', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_system = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at'] 

    @property
    def sender_display_name(self):
        nickname_obj = self.thread.nicknames.filter(user=self.sender).first()
        if nickname_obj:
            return nickname_obj.nickname
        return self.sender.profile.name if hasattr(self.sender, 'profile') and self.sender.profile.name else self.sender.username

    def __str__(self):
        return f"{self.sender.username} in Thread {self.thread.id}"

class ThreadNickname(models.Model):
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name='nicknames')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    nickname = models.CharField(max_length=50)

    class Meta:
        unique_together = ('thread', 'user')

class Story(models.Model):
    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('followers', 'Followers Only'),
        ('custom', 'Custom (Threads)')
    ]
    
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stories')
    image = models.ImageField(upload_to='stories/', blank=True, null=True)
    text_content = models.TextField(blank=True, max_length=500)
    
    created_at = models.DateTimeField(auto_now_add=True)
    visibility = models.CharField(max_length=15, choices=VISIBILITY_CHOICES, default='public')
    
    # let's people in groupchat view your stories
    allowed_threads = models.ManyToManyField('Thread', blank=True, related_name='visible_stories')
    likes = models.ManyToManyField(User, related_name='liked_stories', blank=True)

    #compressor
    def save(self, *args, **kwargs):
        if self.image and getattr(self.image, 'file', None):
            if self.image.size > 1048576:
                self.image = compress_to_1mb(self.image)
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        return self.created_at >= timezone.now() - timedelta(hours=24)

class StoryView(models.Model):
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='views')
    viewer = models.ForeignKey(User, on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('story', 'viewer')

# the model that compress large pics to 1mb limit
def compress_to_1mb(image_field):
    max_bytes = 1048576 
    
    img = Image.open(image_field)
    if img.mode != 'RGB':
        img = img.convert('RGB')
        
    output = io.BytesIO()
    quality = 90
    
    img.save(output, format='JPEG', quality=quality, optimize=True)
    
    while output.tell() > max_bytes and quality > 20:
        output.seek(0)
        output.truncate()
        
        new_width = int(img.width * 0.85)
        new_height = int(img.height * 0.85)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        quality -= 10
        img.save(output, format='JPEG', quality=quality, optimize=True)
        
    output.seek(0)
    return InMemoryUploadedFile(
        output, 'ImageField', 
        f"{image_field.name.split('.')[0]}.jpg", 
        'image/jpeg', sys.getsizeof(output), None
    )