# User manager (Neo4J)

## API
| Route | Method | query/body | Description |
| --- | --- | --- | --- |
| / | GET | - | Show application configuration |
| /users | GET | limit | Get the list of users |
| /users | POST | user properties | Creates a user. Mandatory properties are username (or email_address) and password |
| /users/{user_id} | GET | - | Get the user with the given user ID. |
| /users/{user_id} | DELETE | - | Delete user with the given user ID. |
| /users/{user_id} | PATCH | new user properties | Update user with the given user ID. |
| /users/{user_id}/password | PUT | current password, new_password, new_password_confirm | Update the password of user with the given user ID. |

Note: To target the user currently logged in, use 'self' as ID

## Environment variables
| Variable  | Description |
| --- | --- |
| NEO4J_URL | The URL of the Neo4J instance |
| NEO4J_USERNAME | The username for the Neo4J instance |
| NEO4J_PASSWORD | The password for the Neo4J instance |
| ADMIN_USERNAME | The username for the administrator account, defaults to 'admin' |
| ADMIN_PASSWORD | The password for the administrator account, defaults to 'admin' |
| JWT_SECRET | Secret used to sign Tokens |
