import requests
import os
from dotenv import load_dotenv

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
CLIENT_EMAIL = os.getenv("CLIENT_EMAIL")

auth_url = 'https://workflowy.com/api/auth'
response = requests.post(auth_url, json = {
    'clientId': CLIENT_ID,
    'clientSecret': CLIENT_SECRET,
    'email': [CLIENT_EMAIL]
})

print(response.json())

# access_token = response.json()['access_token']
