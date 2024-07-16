const { IgApiClient } = require('instagram-private-api');
require('dotenv').config();

// Função para enviar uma mensagem de "oi" para um usuário específico
const sendHiMessage = async (username) => {
    try {
        const ig = new IgApiClient();
        ig.state.generateDevice(process.env.IG_USERNAME);
        await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
        console.log('Login efetuado com sucesso!');

        // Obtenha o ID do usuário alvo
        const targetUser = await ig.user.searchExact(username);
        if (!targetUser) {
            throw new Error(`Usuário ${username} não encontrado.`);
        }

        // Enviar a mensagem "oi"
        const message = 'oi';
        await ig.entity.directThread([targetUser.pk]).broadcastText(message);
        console.log(`Mensagem "oi" enviada com sucesso para ${username}`);
    } catch (error) {
        console.error(`Erro ao enviar mensagem para ${username}: ${error.message}`);
    }
};

// Captura o argumento da linha de comando
const args = process.argv.slice(2);
const targetUsername = args[0];

if (!targetUsername) {
    console.error('Por favor, forneça um nome de usuário como argumento.');
    process.exit(1);
}

// Chame a função para enviar a mensagem para o usuário específico
sendHiMessage(targetUsername);