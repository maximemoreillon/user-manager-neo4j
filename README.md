# User manager (Neo4J)

[![pipeline status](https://gitlab.com/moreillon_k8s/user_manager/badges/master/pipeline.svg)](https://gitlab.com/moreillon_k8s/user_manager/)
[![coverage report](https://gitlab.com/moreillon_k8s/user_manager/badges/master/coverage.svg)](https://gitlab.com/moreillon_k8s/user_manager/)
[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/user-manager-neo4j)](https://artifacthub.io/packages/search?repo=user-manager-neo4j)



A simple user management and authentication service built around a Neo4J database

[Project page](https://cms.maximemoreillon.com/articles/585)

## API
| Route | Method | query/body | Description |
| --- | --- | --- | --- |
| / | GET | - | Show application configuration |
| /users | GET | limit | Get the list of users |
| /users | POST | {username, password} | Creates a user |
| /users/{user_id} | GET | - | Get the user with the given user ID. |
| /users/{user_id} | DELETE | - | Delete user with the given user ID. |
| /users/{user_id} | PATCH | new user properties | Update user with the given user ID. |
| /users/{user_id}/password | PUT/PATCH | {new_password, new_password_confirm} | Update the password of user with the given user ID. |
| /auth/login | POST | username, password | Login, i.e. exchange credentials for a JWT |

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
| SMTP_HOST | Host of the SMTP server |
| SMTP_PORT | PORT of the SMTP server |
| SMTP_USERNAME | Username for the  SMTP server |
| SMTP_PASSWORD | Password for the SMTP server |
| SMTP_FROM | E-mail from |

## Docker image

[![dockeri.co](https://dockeri.co/image/moreillon/user-manager)](https://hub.docker.com/r/moreillon/user-manager)