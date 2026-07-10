from django.contrib import admin
from django.contrib.admin.models import LogEntry
from .models import Profile, Post, Report, Notification, Comment, Message, Thread, ThreadNickname

admin.site.register(Profile)
admin.site.register(Post)
admin.site.register(Report)
admin.site.register(Notification)
admin.site.register(Comment)
admin.site.register(Thread)
admin.site.register(Message)
admin.site.register(ThreadNickname)
admin.site.register(LogEntry)