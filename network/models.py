from django.db import models
from django.contrib.auth.models import User
from numpy import diff
from PIL import Image
from django.utils import timezone

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, blank=True)
    pronouns = models.CharField(max_length=50, blank=True)
    location = models.CharField(max_length=100, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    
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

class Post(models.Model):
    #authors details
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(max_length=280)
    created_at = models.DateTimeField(auto_now_add=True)
    
    #interactiions
    likes = models.ManyToManyField(User, related_name='liked_posts', blank=True)
    dislikes = models.ManyToManyField(User, related_name='disliked_posts', blank=True)

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
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report on {self.post.author.username}'s post by {self.reported_by.username}"