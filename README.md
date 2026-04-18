<div align="center">

<img src="docs/chart.svg" alt="" width="130" />

<img src="docs/title.svg" alt="Gastos Mensais" width="280" />

<a href="https://monitoramento-de-gastos.web.app/">
  <img src="https://readme-typing-svg.demolab.com?font=Space+Mono&weight=700&size=19&pause=1200&color=7C3AED&center=true&vCenter=true&width=720&lines=Monitoramento+de+finan%C3%A7as+pessoais;Dashboard%2C+categorias+e+assistente+com+IA;Firebase+%2B+Cohere+%2B+UI+refinada" alt="Tagline" />
</a>

<br /><br />

[![Deploy](https://img.shields.io/badge/deploy-Firebase%20Hosting-7c3aed?logo=firebase&logoColor=white&style=for-the-badge)](https://monitoramento-de-gastos.web.app/)
[![Status](https://img.shields.io/badge/status-em%20produ%C3%A7%C3%A3o-6d28d9?style=for-the-badge)](#)

[![HTML5](https://img.shields.io/badge/HTML5-7c3aed?logo=html5&logoColor=white&style=flat-square)](#)
[![CSS3](https://img.shields.io/badge/CSS3-7c3aed?logo=css3&logoColor=white&style=flat-square)](#)
[![JavaScript](https://img.shields.io/badge/JavaScript-7c3aed?logo=javascript&logoColor=white&style=flat-square)](#)
[![Firebase](https://img.shields.io/badge/Firebase-7c3aed?logo=firebase&logoColor=white&style=flat-square)](#)
[![Cohere](https://img.shields.io/badge/Cohere-7c3aed?logoColor=white&style=flat-square)](#)

### [→ Abrir aplicação](https://monitoramento-de-gastos.web.app/)

</div>

---

## Destaques

- **Assistente de IA integrado** — análise de gastos via Cohere, com modo demo embutido e suporte a Cloud Function para proteger a chave.
- **Segurança de produção** — CSP restritivo, HSTS, `Permissions-Policy` e regras Firestore com whitelist de campos, tipos validados e proteção contra transferência de ownership.
- **UX cuidada** — tela de login com ticker em movimento, logo com pulso animado, modal acessível (armadilha de foco), toasts, date picker customizado e banner offline.
- **Tema claro/escuro** — paleta adaptável, troca suave, preferência persistida.
- **Responsivo** — do desktop ao mobile sem framework de UI.
- **Zero build step** — HTML, CSS e JavaScript (ES modules) puros; deploy direto no Firebase Hosting.

---

## Como funciona

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor':'#1c1c2e',
  'primaryTextColor':'#f0f0f5',
  'primaryBorderColor':'#7c3aed',
  'lineColor':'#a78bfa'
}}}%%
flowchart LR
    U([Usuário]) --> B[Browser]
    B -->|login| FA[Firebase Auth]
    B -->|CRUD| FS[(Firestore)]
    B -->|chat| IA{{IA}}
    IA -->|demo| D[Demo]
    IA -->|direto| CO[Cohere]
    IA -->|proxy| CF[Cloud Fn.] --> CO
    FS -. regras .- R[.rules]

    classDef firebase fill:#6d28d9,stroke:#a78bfa,color:#fff
    classDef cohere   fill:#a78bfa,stroke:#7c3aed,color:#0a0a14
    classDef rules    fill:#13131f,stroke:#2a2a40,color:#8b8ba3

    class FA,FS firebase
    class CO,CF cohere
    class R,D rules
```

### Modelo de dados

Coleção `despesas` — um documento por lançamento.

| Campo | Tipo | Regra |
|---|---|---|
| `tipo` | string | `entrada` ou `saida` |
| `descricao` | string | 1–100 caracteres, não apenas espaços em branco |
| `categoria` | string | whitelist por tipo (ver tabela abaixo) |
| `valor` | number | `> 0` e `≤ 9.999.999,99` |
| `userId` | string | igual a `request.auth.uid`, imutável em updates |
| `pago` | bool | — |
| `dataCriacao` | timestamp | — |

**Saída:** Contas Fixas · Alimentação · Transporte · Educação · Saúde · Outros
**Entrada:** Salário · Freelance · Investimentos · Vendas · Outros

---

## Stack

<p align="center">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=html,css,js,firebase&theme=dark" alt="Stack" />
  </a>
</p>

| Camada | Tecnologia | Por quê |
|---|---|---|
| UI | HTML5, CSS3, JavaScript (ES modules) | Zero build, deploy trivial, controle total da UX |
| Autenticação | Firebase Authentication | Login por e-mail/senha e Google sem backend próprio |
| Banco | Cloud Firestore | Tempo real, regras declarativas, escalável sem servidor |
| Hosting | Firebase Hosting | CDN com headers de segurança configurados via `firebase.json` |
| IA | Cohere Chat API | Respostas em PT-BR, integração HTTP direta, custo previsível |

---

## Segurança

A camada de segurança foi estruturada em três frentes, não apenas "tem login".

**Headers HTTP** — definidos em `firebase.json`
- `Content-Security-Policy` restrito a origens conhecidas (Firebase, Cohere, reCAPTCHA).
- `Strict-Transport-Security` com `preload`.
- `X-Content-Type-Options: nosniff` e `X-Frame-Options: SAMEORIGIN`.
- `Permissions-Policy` bloqueia câmera, microfone, geolocalização e pagamento.

**Regras Firestore** — definidas em `firestore.rules`
- Leitura, edição e exclusão apenas pelo dono (`request.auth.uid == resource.data.userId`).
- `hasAll` + `hasOnly` garantem exatamente os campos esperados — nenhum extra passa.
- Tipos validados por campo, incluindo `timestamp` para `dataCriacao`.
- `userId` imutável em updates: impossível transferir um documento para outro usuário.
- Categorias são whitelists separadas para entrada e saída.
- `valor > 0 && valor ≤ 9.999.999,99` bloqueia negativos e estouros.

**Chave da Cohere**
- *Demo* — chave ausente, a UI mostra mensagem explicativa.
- *Local* — `COHERE_API_KEY` no cliente, apenas para desenvolvimento.
- *Produção* — `USA_CLOUD_FUNCTION = true`, a chave fica no backend e o cliente nunca a vê.

---

## Rodando localmente

**Pré-requisitos**
- [Node.js](https://nodejs.org/)
- [Firebase CLI](https://firebase.google.com/docs/cli)

```bash
git clone https://github.com/carloshjes/gastos-mensais.git
cd gastos-mensais
npm install -g firebase-tools
firebase login
firebase serve
```

<details>
<summary><strong>Configurando um Firebase próprio</strong></summary>

<br />

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. Ative **Authentication** (E-mail/Senha e Google) e **Cloud Firestore**.
3. Substitua o objeto `firebaseConfig` no topo de `public/app.js`.
4. Ajuste `.firebaserc` para o seu `projectId`.
5. Publique as regras:
   ```bash
   firebase deploy --only firestore:rules
   ```

</details>

<details>
<summary><strong>Ativando o assistente de IA</strong></summary>

<br />

**Opção A — chave direto no cliente** (apenas para uso local)

```js
// public/app.js
const COHERE_API_KEY = "sua-chave-aqui";
```

**Opção B — via Cloud Function** (recomendado para produção)

```js
// public/app.js
const USA_CLOUD_FUNCTION = true;
const URL_CLOUD_FUNCTION = 'https://<region>-<projectId>.cloudfunctions.net/chatIA';
```

Na opção B, a chave permanece no backend e o cliente nunca tem acesso.

</details>

---

## Estrutura

```
gastos-mensais/
├── public/
│   ├── index.html      # marcação, telas de login e app
│   ├── style.css       # tema, animações, responsividade
│   ├── app.js          # lógica, Firebase SDK, IA, estado
│   └── 404.html        # fallback de rota
├── firebase.json       # hosting + headers de segurança
├── firestore.rules     # regras de acesso e validação
└── .firebaserc         # projectId
```

---

## Autor

Desenvolvido por **Carlos Henrique** — [@carloshjes](https://github.com/carloshjes)
