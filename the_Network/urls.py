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
from django.urls import path
from network import views
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('robots.txt', TemplateView.as_view(template_name="robots.txt", content_type="text/plain")),
    path('', views.login_view, name='index'),
    path('admin/', admin.site.urls),
    path('home/', views.home_view, name='home'),
    path('profile/', views.profile_view, name='profile'),
    path('messages/', views.messages_view, name='messages'),
    path('search/', views.search_view, name='search'),
    path('registration/', views.registration_view, name='registration'),
    path('login/', views.login_view, name='login'),
    path('baseEntrance/', views.baseEntrance_view, name='baseEntrance'),
    path('update-profile/', views.update_profile, name='update_profile'),
    path('logout/', views.logout_view, name='logout'),
    path('post/<int:post_id>/hide/', views.toggle_hide_post, name='toggle_hide_post'),
    path('post/<int:post_id>/delete/', views.delete_post, name='delete_post'),
    path('post/<int:post_id>/report/', views.report_post, name='report_post'),
    path('follow/<str:username>/', views.toggle_follow, name='toggle_follow'),
    path('base/', views.base_view, name='base'),
    path('post/<int:post_id>/like/', views.toggle_like, name='toggle_like'),
    path('post/<int:post_id>/dislike/', views.toggle_dislike, name='toggle_dislike'),
    path('profile/<str:username>/', views.profile_view, name='user_profile'),
    path('post/<int:post_id>/', views.postDetail, name='postDetail'),
    path('inbox/', views.inbox, name='inbox'),
    path('messages/create-group/', views.create_group_thread, name='create_group_thread'),
    path('messages/group/<int:thread_id>/', views.group_chat_thread, name='group_chat_thread'),
    path('messages/<str:username>/', views.chat_thread, name='chat_thread'),
    path('notification/delete/<int:notif_id>/', views.delete_notification, name='delete_notification'),
    path('notification/clear-all/', views.clear_all_notifications, name='clear_all_notifications'),
    path('comment/<int:comment_id>/like/', views.toggle_comment_like, name='toggle_comment_like'),
    path('comment/<int:comment_id>/dislike/', views.toggle_comment_dislike, name='toggle_comment_dislike'),
    path('comment/<int:comment_id>/hide/', views.toggle_hide_comment, name='toggle_hide_comment'),
    path('comment/<int:comment_id>/delete/', views.delete_comment, name='delete_comment'),
    path('comment/<int:comment_id>/report/', views.report_comment, name='report_comment'),
    path('messages/settings/<int:thread_id>/', views.thread_settings, name='thread_settings'),
    path('account/delete/', views.delete_account, name='delete_account'),
    path('story/<int:story_id>/view/', views.mark_story_viewed, name='mark_story_viewed'),
    path('story/<int:story_id>/delete/', views.delete_story, name='delete_story'),
    path('story/<int:story_id>/reply/', views.reply_to_story, name='reply_to_story'),
    path('story/create/', views.create_story, name='create_story'),
    path('story/<int:story_id>/viewers/', views.get_story_viewers, name='get_story_viewers'),
    path('story/<int:story_id>/like/', views.like_story, name='like_story')
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)