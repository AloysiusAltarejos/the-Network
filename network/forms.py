from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from django import forms
from .models import Profile

class RegisterForm(UserCreationForm):
    email = forms.EmailField(required=True)
    pronouns = forms.CharField(widget=forms.Textarea, required=False)
    bio = forms.CharField(widget=forms.Textarea, required=False)
    location = forms.CharField(max_length=100, required=False)

    class Meta:
        model = User
        fields = ["username", "email"]

    def save(self, commit=True):
        user = super().save(commit=False)
        if commit:
            user.save()
            Profile.objects.create(
                pronouns=self.cleaned_data.get('pronouns'),
                user=user,
                bio=self.cleaned_data.get('bio'),
                location=self.cleaned_data.get('location')
                
            )
        return user