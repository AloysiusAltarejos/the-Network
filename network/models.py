#ALWAYS PYTHON MANAGE.PY MAKEMIGRATIONS AND THEN PYTHON MANAGE.PY MIGRATE AFTER MAKING CHANGES TO MODELS.PY I HATE MIGRATION ISSUES SO MUCH!!!!!
from django.db import models
from django.contrib.auth.models import User
from django.core.files.uploadedfile import InMemoryUploadedFile
from numpy import diff
from PIL import Image
from django.utils import timezone
import io, sys

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
        super().save(*args, **kwargs)
        if self.profile_picture:
            img = Image.open(self.profile_picture.path)
            if img.height > 300 or img.width > 300:
                output_size = (300, 300)
                img.thumbnail(output_size) 
                img.save(self.profile_picture.path, quality=85)
    @property
    def unread_message_count(self):
        return self.user.received_messages.filter(is_read=False).count()

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
        if self.image and not self.id:
            img = Image.open(self.image)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            img.thumbnail((800, 800))
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=30, optimize=True)
            output.seek(0)
            self.image = InMemoryUploadedFile(
                output, 'ImageField', 
                f"{self.image.name.split('.')[0]}.jpg", 
                'image/jpeg', sys.getsizeof(output), None
            )
        super().save(*args, **kwargs)
    #extra
    is_hidden = models.BooleanField(default=False)

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
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True)
    comment = models.ForeignKey('Comment', on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    is_hidden = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at'] 
    def __str__(self):
        return f"{self.sender.username} -> {self.recipient.username} ({self.notification_type})"
    
class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
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
    
class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    content = models.TextField(max_length=1000)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at'] 

    def __str__(self):
        return f"{self.sender.username} to {self.recipient.username}"