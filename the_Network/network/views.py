from django.shortcuts import render

def home_view(request):
    return render(request, 'home.html')
def profile_view(request):
    return render(request, 'profile.html')
def messages_view(request):
    return render(request, 'messages.html')
def search_view(request):
    return render(request, 'search.html')