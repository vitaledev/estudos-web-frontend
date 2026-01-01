# estudos-web-frontend
Repositório para armazenar meus exercícios de HTML, CSS e lógica de programação.
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Apresentação do meu repositório</title>
    <style>
        /* CSS Básico para deixar a página bonita */
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #202124; /* Fundo escuro */
            color: #e8eaed; /* Texto claro */
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh; /* Ocupa a altura total da tela */
            margin: 0;
        }

        .container {
            background-color: #303134; /* Cartão um pouco mais claro */
            padding: 40px;
            border-radius: 20px; /* Bordas arredondadas */
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); /* Sombra suave */
            max-width: 600px; /* Largura máxima do cartão */
            text-align: center;
            border: 2px solid #3c4043;
        }

        h1 {
            color: #8ab4f8; /* Cor azul destaque para o título */
            margin-bottom: 10px;
        }

        .destaque {
            color: #fdd663; /* Amarelo para destacar palavras importantes */
            font-weight: bold;
        }

        ul {
            text-align: left; /* Alinha a lista à esquerda */
            display: inline-block; /* Ajuda a centralizar o bloco da lista */
            margin-top: 20px;
        }

        li {
            margin-bottom: 10px;
            list-style-type: "🚀 "; /* Muda a bolinha da lista por um foguete */
        }

        footer {
            margin-top: 40px;
            font-size: 0.9em;
            color: #9aa0a6;
        }
    </style>
</head>
<body>

    <div class="container">
        <h1>Olá, eu sou o Agnaldo! 👋</h1>
        
        <p>Seja bem-vindo(a) ao meu repositório central de aprendizado.</p>
        
        <p>
            Este espaço no GitHub é dedicado a registrar minha evolução no mundo da tecnologia. 
            Aqui você encontrará desde meus primeiros testes com <span class="destaque">HTML básico</span> 
            até projetos futuros mais complexos.
        </p>

        <h3>🎯 Meu foco atual:</h3>
        <ul>
            <li>Entendendo a estrutura do HTML5.</li>
            <li>Criando links e navegando entre páginas.</li>
            <li>Aprendendo a usar o Git e GitHub para versionar meu código.</li>
        </ul>

        <footer>
            <p><em>"A melhor forma de aprender é fazendo."</em></p>
            <p>Construído com 💙 durante meus estudos.</p>
        </footer>
    </div>
    </body>
</html>
