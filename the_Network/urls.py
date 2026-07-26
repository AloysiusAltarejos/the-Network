"""
URL configuration for the_Network project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, re_path
from network import views
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', TemplateView.as_view(template_name='index.html')),
    
    # --- Authentication & Account ---
    path('api/login/', views.api_login_view, name='api_login'),
    path('api/register/', views.api_register_view, name='api_register'),
    path('api/logout/', views.api_logout_view, name='api_logout'), 
    path('account/delete/', views.delete_account, name='delete_account'),
    
    # --- Profiles ---
    path('api/profile/', views.api_profile_view, name='api_profile_me'),
    path('api/profile/update/', views.api_update_profile, name='api_update_profile'),
    path('api/profile/feed/', views.api_profile_feed, name='api_profile_feed_me'),
    path('api/profile/<str:username>/', views.api_profile_view, name='api_profile_user'),
    path('api/profile/<str:username>/feed/', views.api_profile_feed, name='api_profile_feed_user'),
    path('api/profile/<str:username>/followers/', views.api_get_network, kwargs={'network_type': 'followers'}, name='api_followers'),
    path('api/profile/<str:username>/following/', views.api_get_network, kwargs={'network_type': 'following'}, name='api_following'),
    
    # --- Main Feed & Posts ---
    path('api/home/', views.api_home_view, name='api_home'),
    path('api/posts/create/', views.api_create_post, name='api_create_post'),
    path('api/posts/<int:post_id>/', views.api_post_detail, name='api_post_detail'),
    path('api/posts/<int:post_id>/reply/', views.api_post_reply, name='api_post_reply'),
    path('api/posts/<int:post_id>/<str:action>/', views.api_post_action, name='api_post_action'),
    
    # --- Comments ---
    path('api/comment/<int:pk>/<str:action>/', views.api_comment_action, name='api_comment_action'), 
    
    # --- Stories (Prefix fixed to match React) ---
    path('api/stories/', views.api_stories, name='api_stories'),
    path('api/stories/add/', views.api_add_story, name='api_add_story'),
    path('api/stories/limits/', views.api_story_limits, name='api_story_limits'),
    path('api/stories/<int:story_id>/view/', views.mark_story_viewed, name='mark_story_viewed'),
    path('api/stories/<int:story_id>/delete/', views.delete_story, name='delete_story'),
    path('api/stories/<int:story_id>/reply/', views.reply_to_story, name='reply_to_story'),
    path('api/stories/<int:story_id>/viewers/', views.get_story_viewers, name='get_story_viewers'),
    path('api/stories/<int:story_id>/like/', views.like_story, name='like_story'),
    
    # --- Utilities ---
    path('api/search/', views.api_search_view, name='api_search'),
    path('api/suggested/', views.api_suggested, name='api_suggested'),
    path('api/notifications/', views.api_notifications, name='api_notifications'),
    path('api/notifications/<int:notif_id>/delete/', views.api_delete_notification, name='api_delete_notification'),
    path('api/notifications/clear/', views.api_clear_all_notifications, name='api_clear_all_notifications'),

    path('api/messages/start/<str:username>/', views.api_start_chat, name='api_start_chat'),
    path('api/messages/thread/<int:thread_id>/', views.api_thread, name='api_thread'),
    path('api/users/', views.api_users, name='api_users'),
    path('api/inbox/', views.api_inbox, name='api_inbox'),
    path('api/profile/<str:username>/follow/', views.api_follow_user, name='api_follow_user'),
    path('api/messages/group/create/', views.api_create_group, name='api_create_group'),
    path('api/messages/thread/<int:thread_id>/settings/', views.api_thread_settings, name='api_thread_settings'),
    path('api/notifications/<int:notif_id>/read/', views.api_mark_notification_read, name='api_mark_notification_read'),

    # --- Reports ---
    path('api/report/', views.api_submit_report, name='api_submit_report'),

    # --- Catch all ---
    re_path(r'^.*$', TemplateView.as_view(template_name="index.html")),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)