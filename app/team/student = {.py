import requests

def get_users():

    url = "https://jsonplaceholder.typicode.com/users"
    response = requests.get(url)
    return response.json()

users = get_users()

for user in users:
    print(user["name"])
    print(user["email"])
    print(user["company"]["name"])


