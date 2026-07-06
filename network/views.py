from .models import Profile
from django.shortcuts import render, redirect
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import login, logout
from .forms import RegisterForm
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from .models import Profile, Post
from django.db.models import Q 
from django.shortcuts import render, redirect, get_object_or_404
from .models import Profile, Post, Report 



@login_required(login_url='login')
def profile_view(request):
    return render(request, 'profile.html')

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
        results = User.objects.filter(username__icontains=query)
    return render(request, 'search.html', {'results': results, 'query': query})

@login_required(login_url='login')
def home_view(request):
    if request.method == "POST":
        post_content = request.POST.get('content')
        if post_content:
            Post.objects.create(author=request.user, content=post_content)
            return redirect('home')
    all_posts = Post.objects.filter(
        Q(is_hidden=False) | Q(author=request.user)
    )
    return render(request, 'home.html', {'posts': all_posts})
@login_required(login_url='login')
def messages_view(request):
    return render(request, 'messages.html')

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