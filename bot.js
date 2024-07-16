const { IgApiClient } = require('instagram-private-api');
const fs = require('fs/promises'); // Módulo para manipulação de arquivos
require('dotenv').config();

const retry = async (operation, { retries = parseInt(process.env.RETRY_COUNT) || 3, delay = parseInt(process.env.RETRY_DELAY) || 1000, factor = parseInt(process.env.RETRY_FACTOR) || 2 } = {}) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (error.response && (error.response.statusCode === 429 || error.response.statusCode === 401 || error.response.statusCode === 403)) {
                const apiError = {
                    statusCode: error.response.statusCode,
                    body : error.response.body.message,
                    endpoint: error.endpoint, // Adiciona o endpoint ao objeto de erro
                    messageapi: error.message
                };
                console.log(`Erro ${apiError.statusCode}: ${apiError.body}. Endpoint: ${apiError.endpoint}. APIERROR: ${apiError.messageapi} . Tentando novamente em ${delay / 1000} segundos...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= factor;
            } else {
                throw new Error(`Erro: ${error.message}.`);
            }
        }
    }
    throw new Error(`Número máximo de tentativas excedido (${retries}).`);
};

// Função para ler os nomes de usuário alvo de um arquivo de texto
const readTargetUsernamesFromFile = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        // Divide os nomes de usuário por quebras de linha
        const targetUsernames = data.split('\n').map(username => username.trim());
        return targetUsernames;
    } catch (error) {
        console.error(`Erro ao ler o arquivo ${filePath}: ${error.message}`);
        return [];
    }
};
// Função para ler as mensagens do arquivo
const readMessagesFromFile = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        // Divide as mensagens por quebras de linha
        const messages = data.split('\n').map(message => message.trim());
        return messages;
    } catch (error) {
        console.error(`Erro ao ler o arquivo ${filePath}: ${error.message}`);
        return [];
    }
};

// Função para selecionar aleatoriamente uma mensagem do array
const getRandomMessage = (messages) => {
    const randomIndex = Math.floor(Math.random() * messages.length);
    const selectedMessage = messages[randomIndex];
    console.log(`Mensagem selecionada: "${selectedMessage}"`);
    return selectedMessage;
};

// Função para aguardar um tempo aleatório entre um mínimo e um máximo definidos
const waitRandomTime = async (minDelay, maxDelay) => {
    const delay = getRandom(minDelay || 10000, maxDelay || 40000); // entre 10 e 40 segundos em milissegundos
    const seconds = delay / 1000; // Convertendo milissegundos para segundos
    console.log(`Aguardando ${seconds} segundos...`);
    await new Promise(resolve => setTimeout(resolve, delay));
};

//Função para atualizar mensagem do JSON
const updateMessageStatusFile = async (messageStatus) => {
    try {
        await fs.writeFile('messageStatus.json', JSON.stringify(messageStatus, null, 2));
        console.log('Status de envio de mensagens atualizado e salvo em messageStatus.json');
    } catch (error) {
        console.error(`Erro ao atualizar o arquivo messageStatus.json: ${error.message}`);
    }
};



// Função para enviar mensagens para usuários com erros
const sendMessagesToUsersWithErrors = async (messageStatus, ig, messages) => {
    try {
        // Itera sobre cada usuário com erro
        for (const targetUsername of Object.keys(messageStatus)) {
            const messageStatusForTarget = messageStatus[targetUsername];

            // Verifica se há mensagens com erro para este usuário
            if (Object.values(messageStatusForTarget).some(status => status.status === 'error')) {
                console.log(`Enviando mensagens para usuários com erro para o usuário: ${targetUsername}`);

                // Define a quantidade aleatória de mensagens a serem enviadas
                const messagesToSendWithError = calculateRandomMessagesToSend();
                // Contador de mensagens enviadas
                let messagesSent = 0;

                // Itera sobre as mensagens com erro deste usuário
                for (const username of Object.keys(messageStatusForTarget)) {
                    if (messageStatusForTarget[username].status === 'error') {
                        try {
                            // Selecionar aleatoriamente uma mensagem
                            let message = getRandomMessage(messages);
                            await retry(() => ig.entity.directThread([username]).broadcastText(message));
                            console.log(`Mensagem reenviada com sucesso para ${username}`);
                            messagesSent++; // Incrementa o contador de mensagens enviadas
                            // Atualiza o status para 'success' no arquivo JSON
                            messageStatusForTarget[username].status = 'success';
                            // Salva o arquivo JSON atualizado
                            await updateMessageStatusFile(messageStatus);
                            // Aguarda um tempo aleatório entre o mínimo e o máximo definidos
                            await waitRandomTime(parseInt(process.env.MIN_DELAY), parseInt(process.env.MAX_DELAY));
                            // Verifica se atingiu a quantidade aleatória de mensagens a serem enviadas
                            if (messagesSent >= messagesToSendWithError) {
                                const pauseDuration = calculateRandomPauseDuration();
                                console.log(`Enviou ${messagesSent} mensagens. Aguardando ${pauseDuration / 3600000} horas antes de continuar...`);
                                await new Promise(resolve => setTimeout(resolve, pauseDuration)); // Converte horas para ms e aguarda
                                messagesSent = 0; // Reinicia o contador de mensagens enviadas após a pausa
                            }
                        } catch (error) {
                            console.error(`Erro ao reenviar mensagem para ${username}: ${error.message}`);
                             // Salva o arquivo JSON atualizado
                             await updateMessageStatusFile(messageStatus);
                        }
                    }
                }
            } else {
                console.log(`Não há mensagens com erro para o usuário: ${targetUsername}`);
            }
        }
        console.log('Todos os usuários com mensagens de erro foram processados.');
        return true;
    } catch (err) {
        console.error(err);
        // Salva o arquivo JSON atualizado em caso de erro
        await updateMessageStatusFile(messageStatus);
        return false;
    }
};


// Função para realizar o login e pós-login
const loginAndPostLogin = async () => {
    try {
        const ig = new IgApiClient();
        ig.state.generateDevice(process.env.IG_USERNAME + "328");

        if (process.env.PROXY_URL) {
            ig.state.proxyUrl = process.env.PROXY_URL;
        }

        // Simula o fluxo de pré-login ##DEPRECATED
        //await ig.simulate.preLoginFlow();

        // Faz o login
        const loggedInUser = await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);

        // Simula o fluxo de pós-login ##DEPRECATED
       // await ig.simulate.postLoginFlow();

        console.log(`Login efetuado com sucesso! ${loggedInUser.username}`);

        // Retorna o objeto ig após o pós-login
        return ig;
    } catch (error) {
        console.error('Erro durante o login e pós-login:', error);
        throw error; // Lança o erro para ser tratado externamente
    }
};

// Função para enviar mensagens para os usuários
const sendDirectMessageToFollowers = async (targetUsernames, messages) => {
    let messageStatus;
    try {
        // Realiza o login e pós-login
        const ig = await loginAndPostLogin();

        // Verifica se o arquivo JSON já existe e carrega seu conteúdo, se existir
        try {
            const fileContent = await fs.readFile('messageStatus.json', 'utf-8');
            messageStatus = JSON.parse(fileContent);
        } catch (error) {
            messageStatus = {};
            console.log('O arquivo messageStatus.json ainda não existe ou está vazio.');
        }

        // Itera sobre cada usuário alvo
        for (const targetUsername of targetUsernames) {
            // Inicializa um objeto vazio para armazenar o status de envio de mensagens para este usuário alvo
            const messageStatusForTarget = messageStatus[targetUsername] || {};

            // Obtenha o ID do usuário alvo
            const targetUser = await retry(() => ig.user.searchExact(targetUsername), { retries: 3 });
            if (!targetUser) {
                throw new Error(`Usuário ${targetUsername} não encontrado.`);
            }

            // Obtenha os seguidores do usuário alvo
            const followersFeed = ig.feed.accountFollowers(targetUser.pk);
            const followers = await retry(() => followersFeed.items(), { retries: 3 });

            // Contador de mensagens enviadas
            let messagesSent = 0;

            // Loop sobre os seguidores e enviar mensagens
            for (const follower of followers) {
                try {
                    // Verifica se já foi enviado uma mensagem para este seguidor e se foi bem-sucedida
                    if (!messageStatusForTarget[follower.username] || messageStatusForTarget[follower.username].status !== 'success') {
                        // Selecionar aleatoriamente uma mensagem
                        let message = getRandomMessage(messages)
                        await retry(() => ig.entity.directThread([follower.pk]).broadcastText(message));
                        console.log(`Mensagem enviada com sucesso para ${follower.username}`);
                        // Adiciona um status de sucesso para o usuário na lista
                        messageStatusForTarget[follower.username] = { status: 'success' };
                        // Atualiza o status de envio de mensagens para o usuário alvo no arquivo JSON
                        messageStatus[targetUsername] = messageStatusForTarget;
                        messagesSent++; // Incrementa o contador de mensagens enviadas
                        await updateMessageStatusFile(messageStatus);
                        // Aguarda um tempo aleatório entre o mínimo e o máximo definidos
                        await waitRandomTime(parseInt(process.env.MIN_DELAY), parseInt(process.env.MAX_DELAY));
                        // Verifica se atingiu a quantidade aleatória de mensagens a serem enviadas
                        if (messagesSent >= calculateRandomMessagesToSend()) {
                            const pauseDuration = calculateRandomPauseDuration();
                            console.log(`Enviou ${messagesSent} mensagens. Aguardando ${pauseDuration / 3600000} horas antes de continuar...`);
                            await new Promise(resolve => setTimeout(resolve, pauseDuration)); // Converte horas para ms e aguarda
                            messagesSent = 0; // Reinicia o contador de mensagens enviadas após a pausa
                        }

                    } else {
                        console.log(`A mensagem para ${follower.username} já foi enviada anteriormente com sucesso. Pulando para o próximo seguidor.`);
                    }
                } catch (error) {
                    console.error(`Erro ao enviar mensagem para ${follower.username}: ${error.message}`);
                    // Adiciona um status de erro para o usuário na lista, apenas se o status anterior não foi 'success'
                    if (!messageStatusForTarget[follower.username] || messageStatusForTarget[follower.username].status !== 'success') {
                        messageStatusForTarget[follower.username] = { status: 'error', error: error.message };
                        // Atualiza o status de envio de mensagens para o usuário alvo no arquivo JSON
                        messageStatus[targetUsername] = messageStatusForTarget;
                        await updateMessageStatusFile(messageStatus);
                    }
                }

            }
        }

        console.log('Todas as mensagens foram enviadas e o status atualizado foi salvo em messageStatus.json');

        // Após enviar as mensagens para todos os usuários alvo, envia novamente as mensagens para usuários com erros
        await sendMessagesToUsersWithErrors(messageStatus, ig, messages);

        return true;
    } catch (err) {
        console.error(err);
        // Salva o arquivo JSON atualizado em caso de erro
        await updateMessageStatusFile(messageStatus);
        return false;
    }
};


// Função para gerar um número aleatório entre min e max (inclusivo)
const getRandom = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Função para determinar o tempo de pausa aleatório entre o envio de mensagens
const calculateRandomPauseDuration = () => {
    const minDuration = parseInt(process.env.MIN_PAUSE_DURATION) || 0;
    const maxDuration = parseInt(process.env.MAX_PAUSE_DURATION) || 0;
    return getRandom(minDuration, maxDuration);
};

// Função para determinar a quantidade aleatória de mensagens a serem enviadas antes de uma pausa mais longa
const calculateRandomMessagesToSend = () => {
    const minMessagesToSend = parseInt(process.env.MIN_MESSAGES_TO_SEND) || 50;
    const maxMessagesToSend = parseInt(process.env.MAX_MESSAGES_TO_SEND) || 100;
    return getRandom(minMessagesToSend, maxMessagesToSend);
};

// Arquivo de texto contendo os nomes de usuário alvo
const targetUsernamesFilePath = 'targetUsernames.txt';
// Arquivo de texto contendo as mensagens
const messagesFilePath = 'messagelist.txt';

// Utilize a função para ler os nomes de usuário alvo do arquivo
readTargetUsernamesFromFile(targetUsernamesFilePath)
    .then(async targetUsernames => {
        try {
            if (targetUsernames.length === 0) {
                throw new Error('Nenhum usuário alvo encontrado no arquivo de targetUsernames.txt');
            }

            // Ler mensagens do arquivo
            const messages = await readMessagesFromFile(messagesFilePath);
            if (messages.length === 0) {
                throw new Error('Nenhuma mensagem encontrada no arquivo messagelist.txt');
            }

            // Utilize a função para enviar a mensagem
            return sendDirectMessageToFollowers(targetUsernames, messages);
        } catch (error) {
            console.error(error);
            return false;
        }
    })
    .then(success => {
        if (success) {
            console.log('Lista de usuários alvo lida e mensagens enviadas com sucesso');
        } else {
            console.log('Erro da execução, verifique logs');
        }
    });
