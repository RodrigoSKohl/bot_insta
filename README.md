# SPAM BOT INSTAGRAM
Exemplo de boot de SPAM de mensagens para o Instagram, utilizando a biblioteca **[instagram-private-api](https://www.npmjs.com/package/instagram-private-api)**
## Configuração
- Renomeie /env.example para /.env;
- Modifique as variaveis de acordo com a necessidade[^1];
- No arquivo /messagelist.txt são colocadas as mensagens que serão enviadas para os usuários, uma por linha. No envio elas são carregadas e é enviada uma mensagem aleatória das quais estão adicionadas na lista;
- No arquivo /targetUsernames.txt são adicionados os usuários alvo, todos usuários precisam ser com perfil aberto, visto que o bot ira carregar a lista de seguidores do usuário para começar a enviar as mensagens
- O https://github.com/RodrigoSKohl/bot_insta/blob/main/messageStatus.json é um arquivo onde fica salvo os usuario que receberam as mensagens e também os usuários que tiveram falha. Ao final da execução o bot tem a rotina de tentar reenviar a mensagem para os usuários que retornaram como falha
## Instalação
- Rodar o comando ```npm install```
- Pra iniciar o bot, use ```node bot.js```
- Para testar envio de mensagens use ```node sendtest.js username```[^2]
[^1]: Recomendado usar proxy
[^2]: Username do IG sem @
