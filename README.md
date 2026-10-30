# LockCall v3.0

## Alterações desta versão
- A falta de suporte a `getDisplayMedia()` desativa somente o compartilhamento da própria tela.
- Participantes continuam podendo entrar na sala, assistir às transmissões recebidas, usar o chat e falar pelo microfone.
- O microfone pode ser autorizado enquanto a conexão com o canal está sendo estabelecida; o áudio é enviado automaticamente quando a conexão de dados abre.
- Reprodução de vídeo e áudio remoto ganhou novas tentativas após interação do usuário, útil em navegadores móveis que bloqueiam autoplay.
- O aviso de limitação deixa explícito que a restrição é somente transmitir a própria tela.

## Publicação
Substitua os arquivos atuais na raiz do repositório GitHub Pages pelo `index.html` desta pasta. O endereço público permanece `https://gueten.github.io/lock-site/`.

## Testes
O HTML/JavaScript deve ser validado localmente. A conexão PeerJS/WebRTC entre dispositivos e permissões reais de microfone/tela ainda precisam de teste em Android, iOS e desktop.
