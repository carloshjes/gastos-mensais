# 💰 Gastos Mensais

Aplicação web para **monitoramento de finanças pessoais**, com controle de receitas e despesas, dashboard financeiro e assistente de IA integrado.

🔗 **Acesse o app:** [monitoramento-de-gastos.web.app](https://monitoramento-de-gastos.web.app/)

---

## 📸 Funcionalidades

- 🔐 **Autenticação** — login com e-mail/senha ou conta Google
- 📊 **Dashboard financeiro** — resumo de receitas, despesas e saldo líquido
- ➕ **Lançamentos** — cadastro de despesas e receitas por categoria
- 📈 **Gráfico de uso da receita** — visualização percentual dos gastos
- 🤖 **Assistente de IA** — análise inteligente dos seus gastos com sugestões personalizadas
- 🌙 **Modo claro/escuro** — interface adaptável
- 📱 **Design responsivo** — funciona em desktop e mobile

---

## 🛠️ Tecnologias Utilizadas

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)

- **Front-end:** HTML5, CSS3, JavaScript
- **Back-end / Banco de Dados:** Firebase Firestore
- **Autenticação:** Firebase Authentication
- **Hospedagem:** Firebase Hosting
- **IA:** Assistente financeiro com API de IA integrada

---

## 📁 Estrutura do Projeto

```
gastos-mensais/
│
├── public/
│   ├── index.html       # Estrutura principal da aplicação
│   ├── style.css        # Estilos e tema visual
│   ├── app.js           # Lógica da aplicação
│   └── 404.html         # Página de erro personalizada
│
├── .firebaserc          # Configuração do projeto Firebase
├── firebase.json        # Configuração de hospedagem e Firestore
├── firestore.rules      # Regras de segurança do banco de dados
└── .gitignore
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado
- [Firebase CLI](https://firebase.google.com/docs/cli) instalado

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/carloshjes/gastos-mensais.git

# 2. Acesse a pasta
cd gastos-mensais

# 3. Instale o Firebase CLI (se necessário)
npm install -g firebase-tools

# 4. Faça login no Firebase
firebase login

# 5. Inicie o servidor local
firebase serve
```

---

## 🔒 Segurança

As chaves de API e configurações sensíveis **não estão incluídas** neste repositório. Para rodar o projeto localmente, configure suas próprias credenciais do Firebase.

---

## 👨‍💻 Autor

Desenvolvido por **Carlos Henrique**

- GitHub: [@carloshjes](https://github.com/carloshjes)
