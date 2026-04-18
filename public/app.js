import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";

const firebaseConfig = {
    apiKey: "AIzaSyBO5ZarHI0pbTD2rSU2KOzTLkhEjW3hMbE",
    authDomain: "monitoramento-de-gastos.firebaseapp.com",
    projectId: "monitoramento-de-gastos",
    storageBucket: "monitoramento-de-gastos.firebasestorage.app",
    messagingSenderId: "716662360695",
    appId: "1:716662360695:web:8dfead9a08b56d766d5472"
};

const app = initializeApp(firebaseConfig);

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LddDJ8sAAAAABD3ixWDnvYN93i40ZkpEkED7XMl'),
    isTokenAutoRefreshEnabled: true
});

const db = getFirestore(app);
const auth = getAuth(app);
const despesasRef = collection(db, "despesas");

Chart.register(ChartDataLabels);
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

let meuGrafico = null;
let listaAtualDeDespesas = [];
let pararDeEscutarBanco = null;
let usuarioLogado = null;
let modoCadastro = false;
let idEdicao = null;
let historicoChat = [];

const TEXTOS_AUTH = {
    login: {
        titulo: 'Entre no seu fechamento',
        subtitulo: 'Acesse sua leitura mensal para revisar saldo, acompanhar categorias e registrar novos lan\u00e7amentos com contexto.',
        acao: 'Entrar no Sistema',
        alternancia: 'N\u00e3o tem conta? Crie uma aqui'
    },
    cadastro: {
        titulo: 'Crie sua conta',
        subtitulo: 'Monte seu acesso para acompanhar saldo, categorias e novos lan\u00e7amentos no mesmo painel.',
        acao: 'Criar Conta',
        alternancia: 'J\u00e1 tem conta? Fa\u00e7a login'
    }
};

function atualizarTextosAuth() {
    const conteudo = modoCadastro ? TEXTOS_AUTH.cadastro : TEXTOS_AUTH.login;
    const subtitulo = document.querySelector('.login-subtitulo');
    const apoioLogin = document.querySelector('.login-marca-sub');

    document.getElementById('titulo-login').innerText = conteudo.titulo;
    document.getElementById('btn-entrar').innerText = conteudo.acao;
    document.getElementById('btn-mudar-modo').innerText = conteudo.alternancia;

    if (subtitulo) {
        subtitulo.innerText = conteudo.subtitulo;
    }

    if (apoioLogin) {
        apoioLogin.innerText = 'A entrada acompanha o dashboard para voc\u00ea retomar o m\u00eas com contexto e decidir o pr\u00f3ximo passo mais r\u00e1pido.';
    }
}

document.getElementById('btn-mudar-modo').addEventListener('click', alternarModoAuth);
document.getElementById('btn-sair-nav').addEventListener('click', fazerLogout);
document.getElementById('btn-tema').addEventListener('click', alternarTema);
document.getElementById('filtro-mes').addEventListener('change', filtrarEAtualizar);
document.getElementById('btn-cancelar-edicao').addEventListener('click', cancelarEdicao);

atualizarTextosAuth();

/* =========================================
   FUNÇÕES UTILITÁRIAS
   ========================================= */

function mostrarToast(msg, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span>${tipo === 'sucesso' ? icone('check-circle') : icone('x-circle')}</span> <span>${escaparHTML(msg)}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.4s forwards';
        setTimeout(() => toast.remove(), 400); 
    }, 3500);
}

function formatarMoeda(v) { 
    const valor = parseFloat(v) || 0;
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
}

function escaparHTML(t) {
    return DOMPurify.sanitize(String(t), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONES_SVG = {
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    'check': '<polyline points="20 6 9 17 4 12"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'pencil': '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    'trash': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    'save': '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    'pie-chart': '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
};

const SVG_LUA = `<svg class="icone-tema" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
const SVG_SOL = `<svg class="icone-tema" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;

function icone(nome, tam = 16) {
    const paths = ICONES_SVG[nome];
    if (!paths) return '';
    return `<svg class="icone" width="${tam}" height="${tam}" ${SVG_ATTRS}>${paths}</svg>`;
}

function infoCategoria(c) {
    const i = {
        'Contas Fixas': { classe: 'cat-contas', cor: '#fb7185' },
        'Alimentação': { classe: 'cat-alimentacao', cor: '#34d399' },
        'Transporte': { classe: 'cat-transporte', cor: '#60a5fa' },
        'Educação': { classe: 'cat-educacao', cor: '#a78bfa' },
        'Saúde': { classe: 'cat-saude', cor: '#f472b6' },
        'Outros': { classe: 'cat-outros', cor: '#fbbf24' },
        'Salário': { classe: 'cat-salario', cor: '#34d399' },
        'Freelance': { classe: 'cat-freelance', cor: '#22d3ee' },
        'Investimentos': { classe: 'cat-investimentos', cor: '#a78bfa' },
        'Vendas': { classe: 'cat-vendas', cor: '#fb923c' }
    };
    return i[c] || i['Outros'];
}

/* =========================================
   CONTROLO DE CATEGORIAS E DATAS
   ========================================= */

const categoriasDespesa = ['Contas Fixas', 'Alimentação', 'Transporte', 'Educação', 'Saúde', 'Outros'];
const categoriasReceita = ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Outros'];

function atualizarCategoriasSelect() {
    const tipo = document.getElementById('tipo-lancamento').value;
    const select = document.getElementById('categoria');
    const valorAtual = select.value;
    const cats = tipo === 'entrada' ? categoriasReceita : categoriasDespesa;
    
    select.innerHTML = '<option value="" disabled selected>Escolha...</option>';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
    
    if (cats.includes(valorAtual)) {
        select.value = valorAtual;
    }
}

document.getElementById('tipo-lancamento').addEventListener('change', atualizarCategoriasSelect);

function formatarDataDisplay(valorISO) {
    if (!valorISO) return 'Selecionar data';
    const [ano, mes, dia] = valorISO.split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${parseInt(dia)} de ${meses[parseInt(mes) - 1]}. ${ano}`;
}

function paraInputDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function inicializarDatePicker() {
    const input = document.getElementById('data-lancamento');
    const parent = input.parentElement;

    const wrapper = document.createElement('div');
    wrapper.className = 'data-picker-custom';

    const texto = document.createElement('span');
    texto.className = 'data-picker-texto';
    texto.id = 'data-picker-display';

    const seta = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    seta.setAttribute('class', 'data-picker-seta');
    seta.setAttribute('viewBox', '0 0 24 24');
    seta.setAttribute('fill', 'none');
    seta.setAttribute('stroke', 'currentColor');
    seta.setAttribute('stroke-width', '2.5');
    seta.setAttribute('stroke-linecap', 'round');
    seta.setAttribute('stroke-linejoin', 'round');
    seta.innerHTML = '<polyline points="6 9 12 15 18 9"/>';

    parent.appendChild(wrapper);
    wrapper.appendChild(texto);
    wrapper.appendChild(seta);
    wrapper.appendChild(input);

    input.addEventListener('change', () => {
        texto.textContent = formatarDataDisplay(input.value);
    });
}

function definirDataPadrao() {
    const input = document.getElementById('data-lancamento');
    input.value = paraInputDate(new Date());

    const display = document.getElementById('data-picker-display');
    if (display) {
        display.textContent = formatarDataDisplay(input.value);
    }
}

inicializarDatePicker();
definirDataPadrao();

function obterMesAno(dataInput) {
    if (!dataInput) return "";
    const d = dataInput.toDate ? dataInput.toDate() : new Date(dataInput);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function obterMillis(d) {
    if (!d) return 0;
    if (typeof d.toMillis === 'function') return d.toMillis();
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
}

function cancelarEdicao() {
    idEdicao = null;
    document.getElementById('form-despesa').reset();
    
    const btnSubmit = document.getElementById('btn-submit');
    btnSubmit.innerHTML = "Adicionar Lançamento";
    btnSubmit.style.backgroundColor = "var(--primaria)";
    
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
    
    atualizarCategoriasSelect();
    definirDataPadrao();
}

/* =========================================
   MODAL E INTERFACE
   ========================================= */

let resolverModal = null;
let elementoFocadoAntesModal = null;

const modalConfirmar = document.getElementById('modal-confirmar');
const modalCaixa = modalConfirmar.querySelector('.modal-caixa');
const btnModalCancelar = document.getElementById('modal-cancelar');
const btnModalConfirmar = document.getElementById('modal-confirmar-btn');
const SELETOR_FOCO_MODAL = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function restaurarFocoModal() {
    if (elementoFocadoAntesModal && document.contains(elementoFocadoAntesModal)) {
        elementoFocadoAntesModal.focus();
    }
    elementoFocadoAntesModal = null;
}

function fecharModal(confirmado = false) {
    modalConfirmar.style.display = 'none';
    modalConfirmar.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', tratarTecladoModal);

    if (resolverModal) {
        resolverModal(confirmado);
        resolverModal = null;
    }

    restaurarFocoModal();
}

function tratarTecladoModal(e) {
    if (modalConfirmar.style.display !== 'flex') return;

    if (e.key === 'Escape') {
        e.preventDefault();
        fecharModal(false);
        return;
    }

    if (e.key !== 'Tab') return;

    const focaveis = Array.from(modalCaixa.querySelectorAll(SELETOR_FOCO_MODAL));
    if (!focaveis.length) {
        e.preventDefault();
        modalCaixa.focus();
        return;
    }

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
    }
}

function abrirModal(titulo, mensagem, textoBotao = 'Confirmar') {
    return new Promise((resolve) => {
        resolverModal = resolve;
        elementoFocadoAntesModal = document.activeElement;
        document.getElementById('modal-titulo').textContent = titulo;
        document.getElementById('modal-mensagem').textContent = mensagem;
        btnModalConfirmar.textContent = textoBotao;
        modalConfirmar.style.display = 'flex';
        modalConfirmar.setAttribute('aria-hidden', 'false');
        document.addEventListener('keydown', tratarTecladoModal);

        requestAnimationFrame(() => {
            btnModalCancelar.focus();
        });
    });
}

btnModalCancelar.addEventListener('click', () => {
    fecharModal(false);
});

btnModalConfirmar.addEventListener('click', () => {
    fecharModal(true);
});

modalConfirmar.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        fecharModal(false);
    }
});

let timerBusca = null;
document.getElementById('input-busca').addEventListener('input', () => {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => filtrarEAtualizar(), 250);
});

function animarValor(elemento, valorFinal, duracao = 600) {
    const textoAtual = elemento.innerText.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const valorInicial = parseFloat(textoAtual) || 0;
    const diff = valorFinal - valorInicial;
    if (Math.abs(diff) < 0.01) {
        elemento.innerText = formatarMoeda(valorFinal);
        return;
    }
    const inicio = performance.now();
    
    function step(timestamp) {
        const progresso = Math.min((timestamp - inicio) / duracao, 1);
        const eased = 1 - Math.pow(1 - progresso, 3);
        const valorAtual = valorInicial + diff * eased;
        elemento.innerText = formatarMoeda(valorAtual);
        elemento.classList.add('valor-animando');
        if (progresso < 1) {
            requestAnimationFrame(step);
        } else {
            elemento.innerText = formatarMoeda(valorFinal);
            elemento.classList.remove('valor-animando');
        }
    }
    requestAnimationFrame(step);
}

/* =========================================
   AUTENTICACAO E LOGIN
   ========================================= */

function alternarModoAuth() {
    modoCadastro = !modoCadastro;
    document.getElementById('msg-erro').style.display = 'none';
    document.getElementById('container-confirma-senha').style.display = modoCadastro ? 'flex' : 'none';
    document.getElementById('container-forca-senha').style.display = modoCadastro ? 'flex' : 'none';
    document.getElementById('confirma-senha').required = modoCadastro;
    atualizarTextosAuth();
    
    if (!modoCadastro) {
        document.getElementById('senha-login').value = '';
        document.getElementById('confirma-senha').value = '';
        resetarForcaSenha();
    } else {
        verificarForcaSenha(document.getElementById('senha-login').value);
    }
}

document.getElementById('senha-login').addEventListener('input', (e) => {
    if (modoCadastro) {
        verificarForcaSenha(e.target.value);
    }
});

function verificarForcaSenha(senha) {
    const barras = [
        document.getElementById('forca-barra-1'),
        document.getElementById('forca-barra-2'),
        document.getElementById('forca-barra-3'),
        document.getElementById('forca-barra-4')
    ];
    const textoEl = document.getElementById('forca-senha-texto');
    const dicasEl = document.getElementById('forca-senha-dicas');
    
    const criterios = [
        { regex: /.{6,}/, label: '6+ caracteres' },
        { regex: /[A-Z]/, label: 'Letra maiúscula' },
        { regex: /[0-9]/, label: 'Número' },
        { regex: /[^A-Za-z0-9]/, label: 'Caractere especial' },
    ];
    
    let pontuacao = 0;
    let htmlDicas = '';
    
    criterios.forEach(c => {
        const passou = c.regex.test(senha);
        if (passou) pontuacao++;
        htmlDicas += `<span class="dica-senha ${passou ? 'completa' : 'pendente'}">${passou ? '\u2713' : '\u25cb'} ${c.label}</span>`;
    });
    
    if (senha.length >= 12) pontuacao = Math.min(pontuacao + 1, 4);
    
    dicasEl.innerHTML = htmlDicas;
    
    const niveis = [
        { classe: 'ativa-fraca', texto: 'Muito fraca', classeTexto: 'texto-fraca' },
        { classe: 'ativa-fraca', texto: 'Fraca', classeTexto: 'texto-fraca' },
        { classe: 'ativa-media', texto: 'Razoável', classeTexto: 'texto-media' },
        { classe: 'ativa-boa', texto: 'Boa', classeTexto: 'texto-boa' },
        { classe: 'ativa-forte', texto: 'Muito forte!', classeTexto: 'texto-forte' },
    ];
    
    const nivel = niveis[senha.length === 0 ? 0 : Math.min(pontuacao, 4)];
    
    barras.forEach((barra, i) => {
        barra.className = 'forca-barra';
        if (senha.length > 0 && i < pontuacao) {
            barra.classList.add(nivel.classe);
        }
    });
    
    textoEl.textContent = senha.length === 0 ? '' : nivel.texto;
    textoEl.className = 'forca-senha-texto ' + (senha.length > 0 ? nivel.classeTexto : '');
}

function resetarForcaSenha() {
    const barras = document.querySelectorAll('.forca-barra');
    barras.forEach(b => b.className = 'forca-barra');
    document.getElementById('forca-senha-texto').textContent = '';
    document.getElementById('forca-senha-texto').className = 'forca-senha-texto';
    document.getElementById('forca-senha-dicas').innerHTML = '';
}

function fazerLogout() {
    signOut(auth);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogado = user;
        document.body.classList.add('app-logado');
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('tela-app').style.display = 'block';
        document.getElementById('btn-sair-nav').style.display = 'block';
        document.getElementById('btn-abrir-chat').style.display = 'flex';
        resetarMensagemInicialIA();
        atualizarEstadoChat();

        const nome = user.displayName || (user.email ? user.email.split('@')[0] : 'usuário');
        const hora = new Date().getHours();
        let saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
        document.getElementById('saudacao-usuario').querySelector('h2').innerHTML = 
            `<span class="saudacao-linha">${saudacao},</span><span id="nome-usuario" class="saudacao-nome">${escaparHTML(nome)}!</span>`;
        
        carregarBancoDeDados(user.uid); 
        resetarTimer();
    } else {
        usuarioLogado = null;
        document.body.classList.remove('app-logado');
        document.getElementById('tela-login').style.display = 'flex';
        document.getElementById('tela-app').style.display = 'none';
        document.getElementById('btn-sair-nav').style.display = 'none';
        document.getElementById('btn-abrir-chat').style.display = 'none';
        document.getElementById('container-chat-ia').classList.add('chat-ia-oculto');
        atualizarEstadoChat();
        resetarMensagemInicialIA();
        historicoChat = [];

        if (pararDeEscutarBanco) pararDeEscutarBanco(); 
        clearTimeout(timerInatividade);
    }
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-login').value;
    const senha = document.getElementById('senha-login').value;
    const msgErroUI = document.getElementById('msg-erro');
    
    msgErroUI.style.display = 'none';

    if (modoCadastro && senha !== document.getElementById('confirma-senha').value) {
        return mostrarToast("Senhas diferentes!", "erro");
    }

    try {
        if (modoCadastro) await createUserWithEmailAndPassword(auth, email, senha);
        else await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) { 
        msgErroUI.style.display = 'block';
        let mensagem = "Erro ao acessar. Verifique os dados.";
        switch (error.code) {
            case 'auth/invalid-email':
                mensagem = "E-mail inválido. Verifique o formato."; break;
            case 'auth/user-not-found':
                mensagem = "Nenhuma conta encontrada com esse e-mail."; break;
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                mensagem = "Senha incorreta. Tente novamente."; break;
            case 'auth/email-already-in-use':
                mensagem = "Este e-mail já está cadastrado. Faça login."; break;
            case 'auth/weak-password':
                mensagem = "A senha deve ter no mínimo 6 caracteres."; break;
            case 'auth/too-many-requests':
                mensagem = "Muitas tentativas. Aguarde alguns minutos."; break;
            case 'auth/network-request-failed':
                mensagem = "Erro de conexão. Verifique sua internet."; break;
        }
        msgErroUI.innerText = mensagem;
        mostrarToast(mensagem, "erro"); 
    }
});

const provedorGoogle = new GoogleAuthProvider();

document.getElementById('btn-google').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provedorGoogle);
        mostrarToast("Login com Google realizado!", "sucesso");
    } catch (error) {
        console.error("Erro no login social:", error);
        mostrarToast("O login com o Google foi cancelado ou falhou.", "erro");
    }
});

/* =========================================
   OPERACOES NO FIRESTORE
   ========================================= */

function carregarBancoDeDados(uid) {
    if (pararDeEscutarBanco) {
        pararDeEscutarBanco();
        pararDeEscutarBanco = null;
    }

    const q = query(despesasRef, where("userId", "==", uid), orderBy("dataCriacao", "desc"));
    pararDeEscutarBanco = onSnapshot(q, (snap) => {
        listaAtualDeDespesas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        listaAtualDeDespesas.sort((a, b) => obterMillis(b.dataCriacao) - obterMillis(a.dataCriacao));

        atualizarOpcoesDeMeses(listaAtualDeDespesas);
        filtrarEAtualizar();
    }, (error) => {
        console.error("Erro no snapshot (pode ser necessário criar o índice composto):", error);
        
        if (pararDeEscutarBanco) {
            pararDeEscutarBanco();
            pararDeEscutarBanco = null;
        }

        const qFallback = query(despesasRef, where("userId", "==", uid));
        pararDeEscutarBanco = onSnapshot(qFallback, (snap) => {
            listaAtualDeDespesas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            listaAtualDeDespesas.sort((a, b) => obterMillis(b.dataCriacao) - obterMillis(a.dataCriacao));
            atualizarOpcoesDeMeses(listaAtualDeDespesas);
            filtrarEAtualizar();
        });
    });
}

document.getElementById('form-despesa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.disabled = true;

    const dataInput = document.getElementById('data-lancamento').value;
    const valorInput = parseFloat(document.getElementById('valor').value);
    const descricaoInput = document.getElementById('descricao');
    const descricao = descricaoInput.value.trim();

    if (!descricao) {
        mostrarToast("Informe uma descrição válida.", "erro");
        btn.disabled = false;
        descricaoInput.focus();
        return;
    }

    descricaoInput.value = descricao;

    if (isNaN(valorInput) || valorInput <= 0) {
        mostrarToast("Informe um valor válido e positivo.", "erro");
        btn.disabled = false;
        return;
    }

    const dados = {
        tipo: document.getElementById('tipo-lancamento').value,
        descricao,
        categoria: document.getElementById('categoria').value,
        valor: valorInput,
        userId: usuarioLogado.uid
    };

    if (dataInput) {
        const [ano, mes, dia] = dataInput.split('-');
        dados.dataCriacao = Timestamp.fromDate(new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 12, 0, 0));
    } else {
        dados.dataCriacao = Timestamp.fromDate(new Date());
    }

    try {
        if (idEdicao) {
            const itemOriginal = listaAtualDeDespesas.find(d => d.id === idEdicao);
            
            if (!itemOriginal) {
                mostrarToast("Este registro não existe mais. Ele pode ter sido apagado.", "erro");
                cancelarEdicao();
                btn.disabled = false;
                return;
            }
            
            dados.pago = itemOriginal.pago;
            
            if (!dataInput && itemOriginal.dataCriacao) {
                dados.dataCriacao = itemOriginal.dataCriacao;
            }

            await updateDoc(doc(db, "despesas", idEdicao), dados);
            mostrarToast("Registro atualizado!");
            cancelarEdicao();
        } else {
            dados.pago = false;
            await addDoc(despesasRef, dados);
            mostrarToast("Registro salvo!");
            e.target.reset();
            definirDataPadrao();
            atualizarCategoriasSelect();
        }
    } catch (err) { 
        console.error("Erro detalhado na operação do Firestore: ", err);
        mostrarToast("Erro ao salvar no banco. Tente novamente.", "erro"); 
    } finally { 
        btn.disabled = false; 
    }
});

document.getElementById('tabela-corpo').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const id = btn.dataset.id;

    try {
        if (btn.classList.contains('btn-status')) {
            const item = listaAtualDeDespesas.find(d => d.id === id);
            if (!item) return;
            const novoPago = !item.pago;
            
            const linha = btn.closest('tr');
            if (linha) {
                linha.classList.add(novoPago ? 'animacao-pago' : 'animacao-pendente');
                setTimeout(() => linha.classList.remove('animacao-pago', 'animacao-pendente'), 600);
            }
            
            await updateDoc(doc(db, "despesas", id), { pago: novoPago });
            mostrarToast(novoPago ? "Marcado como pago!" : "Marcado como pendente");
            
        } else if (btn.classList.contains('btn-excluir')) {
            const item = listaAtualDeDespesas.find(d => d.id === id);
            const nomeItem = item ? item.descricao : 'este lançamento';
            const confirmou = await abrirModal(
                'Apagar lançamento',
                `Tem certeza que deseja apagar "${nomeItem}"? Esta ação não pode ser desfeita.`,
                'Apagar'
            );
            if (confirmou) {
                await deleteDoc(doc(db, "despesas", id));
                mostrarToast("Registro apagado!");
            }
            
        } else if (btn.classList.contains('btn-editar')) {
            const item = listaAtualDeDespesas.find(d => d.id === id);
            if (!item) return;
            idEdicao = id;
            
            document.getElementById('tipo-lancamento').value = item.tipo || 'saida';
            atualizarCategoriasSelect();
            document.getElementById('descricao').value = item.descricao;
            document.getElementById('categoria').value = item.categoria;
            document.getElementById('valor').value = item.valor;
            
            if (item.dataCriacao) {
                const d = item.dataCriacao.toDate ? item.dataCriacao.toDate() : new Date(item.dataCriacao);
                const valorData = paraInputDate(d);
                document.getElementById('data-lancamento').value = valorData;
                const dp = document.getElementById('data-picker-display');
                if (dp) dp.textContent = formatarDataDisplay(valorData);
            } else {
                document.getElementById('data-lancamento').value = '';
                const dp = document.getElementById('data-picker-display');
                if (dp) dp.textContent = formatarDataDisplay('');
            }
            
            const btnSubmit = document.getElementById('btn-submit');
            btnSubmit.innerHTML = icone('save') + " Salvar Alterações";
            btnSubmit.style.backgroundColor = "var(--sucesso)";
            document.getElementById('btn-cancelar-edicao').style.display = 'block';
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } catch (err) {
        console.error("Erro na operação:", err);
        mostrarToast("Erro ao processar. Tente novamente.", "erro");
    }
});

function atualizarOpcoesDeMeses(dados) {
    const select = document.getElementById('filtro-mes');
    const meses = new Set();
    const atual = obterMesAno(new Date());
    
    meses.add(atual);
    dados.forEach(i => { if(i.dataCriacao) meses.add(obterMesAno(i.dataCriacao)); });

    const valorAntigo = select.value || atual;
    select.innerHTML = '<option value="Todos">Todos os meses</option>';
    
    const mesesOrdenados = Array.from(meses).sort((a, b) => {
        const [mesA, anoA] = a.split('/');
        const [mesB, anoB] = b.split('/');
        const valorDataA = (parseInt(anoA) * 12) + parseInt(mesA);
        const valorDataB = (parseInt(anoB) * 12) + parseInt(mesB);
        return valorDataB - valorDataA;
    });

    mesesOrdenados.forEach(m => {
        select.innerHTML += `<option value="${escaparHTML(m)}">${escaparHTML(m)}</option>`;
    });
    
    const opcaoExiste = [...select.options].some(opt => opt.value === valorAntigo);
    
    if (opcaoExiste) {
        select.value = valorAntigo;
    } else {
        const mesAtualExiste = [...select.options].some(opt => opt.value === atual);
        select.value = mesAtualExiste ? atual : 'Todos';
    }
}

function filtrarEAtualizar() {
    const mesSelecionado = document.getElementById('filtro-mes').value;
    const textoBusca = (document.getElementById('input-busca').value || '').trim().toLowerCase();
    
    let filtrados = mesSelecionado === "Todos" 
        ? listaAtualDeDespesas 
        : listaAtualDeDespesas.filter(i => obterMesAno(i.dataCriacao) === mesSelecionado);
    
    if (textoBusca) {
        filtrados = filtrados.filter(i => {
            const descricao = (i.descricao || '').toLowerCase();
            const categoria = (i.categoria || '').toLowerCase();
            const valor = String(i.valor ?? '');
            return (
                descricao.includes(textoBusca) ||
                categoria.includes(textoBusca) ||
                valor.includes(textoBusca)
            );
        });
    }
    
    atualizarInterface(filtrados);
}

/* =========================================
   ATUALIZACAO DE INTERFACE E GRAFICOS
   ========================================= */

function atualizarNarrativaDashboard(receitas, despesas, saldo, totaisPorCategoria) {
    const statusEl = document.getElementById('status-orcamento');
    const insightEl = document.getElementById('resumo-insight');
    const totalCategoriasEl = document.getElementById('dashboard-total-categorias');
    const categoriaLiderEl = document.getElementById('dashboard-categoria-lider');
    const graficoTotalEl = document.getElementById('grafico-total-despesas');
    const graficoDetalheEl = document.getElementById('grafico-centro-detalhe');

    const categoriasOrdenadas = Object.entries(totaisPorCategoria || {}).sort((a, b) => b[1] - a[1]);
    const categoriaLider = categoriasOrdenadas[0];
    const totalCategorias = categoriasOrdenadas.length;
    const percentualUso = receitas > 0 ? (despesas / receitas) * 100 : 0;

    if (graficoTotalEl) {
        graficoTotalEl.textContent = formatarMoeda(despesas);
    }

    if (totalCategoriasEl) {
        totalCategoriasEl.textContent = totalCategorias === 0
            ? '0 categorias monitoradas'
            : `${totalCategorias} categoria${totalCategorias > 1 ? 's' : ''} monitorada${totalCategorias > 1 ? 's' : ''}`;
    }

    if (categoriaLiderEl) {
        if (categoriaLider) {
            const percentualLider = despesas > 0 ? (categoriaLider[1] / despesas) * 100 : 0;
            categoriaLiderEl.textContent = `${categoriaLider[0]} lidera com ${percentualLider.toFixed(0)}%`;
        } else {
            categoriaLiderEl.textContent = 'Sem destaque no período';
        }
    }

    if (graficoDetalheEl) {
        if (categoriaLider) {
            const percentualLider = despesas > 0 ? (categoriaLider[1] / despesas) * 100 : 0;
            graficoDetalheEl.textContent = `${categoriaLider[0]} responde por ${percentualLider.toFixed(0)}% das saídas`;
        } else {
            graficoDetalheEl.textContent = 'Nenhuma categoria com pressão registrada';
        }
    }

    if (!statusEl || !insightEl) return;

    let statusClasse = 'status-neutro';
    let statusTexto = 'Aguardando dados';
    let insightTexto = 'Seu fechamento vai ganhar uma leitura rápida assim que houver movimentações registradas.';

    if (receitas <= 0 && despesas <= 0) {
        statusTexto = 'Sem movimento';
    } else if (receitas <= 0 && despesas > 0) {
        statusClasse = 'status-critico';
        statusTexto = 'Sem cobertura';
        insightTexto = `Há ${formatarMoeda(despesas)} em saídas no período, mas nenhuma receita registrada para cobrir esse movimento.`;
    } else if (saldo < 0 || percentualUso >= 100) {
        statusClasse = 'status-critico';
        statusTexto = 'No vermelho';
        insightTexto = `As saídas já ultrapassaram a receita em ${formatarMoeda(Math.abs(saldo))}. Vale revisar o maior foco de gasto agora.`;
    } else if (percentualUso >= 80) {
        statusClasse = 'status-alerta';
        statusTexto = 'No limite';
        insightTexto = `${percentualUso.toFixed(0)}% da receita já foi comprometida. O período segue positivo, mas com margem curta.`;
    } else if (percentualUso >= 60) {
        statusClasse = 'status-alerta';
        statusTexto = 'Atenção ativa';
        insightTexto = `${percentualUso.toFixed(0)}% da receita foi usada. Ainda há folga, mas o ritmo de saída merece acompanhamento.`;
    } else if (despesas === 0 && receitas > 0) {
        statusClasse = 'status-positivo';
        statusTexto = 'Fôlego total';
        insightTexto = `Todo o valor de ${formatarMoeda(receitas)} segue preservado no período, sem saídas registradas até agora.`;
    } else {
        statusClasse = 'status-positivo';
        statusTexto = 'Sob controle';
        insightTexto = `Você preserva ${formatarMoeda(saldo)} no período, com ${formatarMoeda(receitas - despesas)} ainda disponível para decisão.`;
    }

    statusEl.className = `resumo-status-chip ${statusClasse}`;
    statusEl.textContent = statusTexto;
    insightEl.textContent = insightTexto;
}

function atualizarInterface(dados) {
    const tabela = document.getElementById('tabela-corpo');
    const dashCat = document.getElementById('dashboard-categorias');
    tabela.innerHTML = ''; 
    
    if (dados.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="5" style="border: none;">
                    <div class="estado-vazio">
                        <div class="estado-vazio-icone">${icone('file-text', 48)}</div>
                        <h4>Nenhum lançamento encontrado</h4>
                        <p>Adicione seu primeiro lançamento usando o formulário acima.</p>
                    </div>
                </td>
            </tr>`;
        
        animarValor(document.getElementById('valor-receitas-display'), 0);
        animarValor(document.getElementById('valor-despesas-display'), 0);
        
        const elSaldo = document.getElementById('valor-saldo-display');
        animarValor(elSaldo, 0);
        elSaldo.classList.remove('brilho-negativo', 'brilho-positivo');
        
        atualizarBarraProgresso(0, 0);
        atualizarNarrativaDashboard(0, 0, 0, {});
        
        dashCat.innerHTML = `
            <div class="estado-vazio" style="padding: 20px 10px;">
                <div class="estado-vazio-icone">${icone('pie-chart', 48)}</div>
                <h4>Radar aguardando movimento</h4>
                <p>Seus gastos por categoria aparecerão aqui.</p>
            </div>`;
        
        if (meuGrafico) { meuGrafico.destroy(); meuGrafico = null; }
        return;
    }

    let totalReceitas = 0, totalDespesas = 0, totaisPorCategoria = {};

    dados.forEach(item => {
        const tipo = item.tipo || 'saida';
        const categoriaLabel = item.categoria || 'Sem categoria';
        if (tipo === 'entrada') {
            totalReceitas += item.valor;
        } else {
            totalDespesas += item.valor;
            totaisPorCategoria[categoriaLabel] = (totaisPorCategoria[categoriaLabel] || 0) + item.valor;
        }

        const info = infoCategoria(categoriaLabel);
        const tr = document.createElement('tr');
        tr.className = item.pago ? 'linha-paga' : '';
        
        const classeCorValor = tipo === 'entrada' ? 'valor-positivo' : 'valor-negativo';
        const sinal = tipo === 'entrada' ? '+' : '-';
        const rotuloStatus = item.pago ? 'Marcar como pendente' : 'Marcar como pago';

        let dataFormatada = '\u2014';
        if (item.dataCriacao) {
            const d = item.dataCriacao.toDate ? item.dataCriacao.toDate() : new Date(item.dataCriacao);
            dataFormatada = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        tr.innerHTML = `
            <td data-label="Ações"><div class="acoes-container">
                <button class="btn-status ${item.pago ? 'status-pago' : 'status-pendente'}" data-id="${escaparHTML(item.id)}" title="${rotuloStatus}" aria-label="${rotuloStatus}" aria-pressed="${item.pago ? 'true' : 'false'}">${item.pago ? icone('check', 14) : icone('clock', 14)}</button>
                <button class="btn-editar" data-id="${escaparHTML(item.id)}" title="Editar lançamento" aria-label="Editar lançamento">${icone('pencil', 14)}</button>
                <button class="btn-excluir" data-id="${escaparHTML(item.id)}" title="Apagar lançamento" aria-label="Apagar lançamento">${icone('trash', 14)}</button>
            </div></td>
            <td data-label="Descrição"><strong>${escaparHTML(item.descricao)}</strong></td>
            <td data-label="Categoria"><span class="tag ${info.classe}">${escaparHTML(categoriaLabel)}</span></td>
            <td data-label="Data">${dataFormatada}</td>
            <td data-label="Valor" class="${classeCorValor} coluna-valor">
                <strong>${sinal} ${formatarMoeda(item.valor)}</strong>
            </td>`;
        tabela.appendChild(tr);
    });

    animarValor(document.getElementById('valor-receitas-display'), totalReceitas);
    animarValor(document.getElementById('valor-despesas-display'), totalDespesas);
    
    const saldo = totalReceitas - totalDespesas;
    const elSaldo = document.getElementById('valor-saldo-display');
    animarValor(elSaldo, saldo);
    
    if (saldo >= 0) {
        elSaldo.classList.remove('brilho-negativo');
        elSaldo.classList.add('brilho-positivo');
    } else {
        elSaldo.classList.remove('brilho-positivo');
        elSaldo.classList.add('brilho-negativo');
    }

    atualizarBarraProgresso(totalDespesas, totalReceitas);
    atualizarNarrativaDashboard(totalReceitas, totalDespesas, saldo, totaisPorCategoria);

    let htmlCategorias = '';
    Object.entries(totaisPorCategoria)
        .sort(([, valorA], [, valorB]) => valorB - valorA)
        .forEach(([cat, valorCategoria], index) => {
            const info = infoCategoria(cat);
            const pct = totalDespesas > 0 ? ((valorCategoria / totalDespesas) * 100).toFixed(1) : 0;
            const larguraBarra = totalDespesas > 0 ? Math.max((valorCategoria / totalDespesas) * 100, 8) : 0;
            htmlCategorias += `
                <div class="card-cat" style="--categoria-accent: ${info.cor};">
                    <span class="card-cat-ranking">${String(index + 1).padStart(2, '0')}</span>
                    <div class="card-cat-conteudo">
                        <div class="card-cat-header">
                            <span class="card-cat-dot" aria-hidden="true"></span>
                            <span class="card-cat-nome">${escaparHTML(cat)}</span>
                        </div>
                        <div class="card-cat-trilha" aria-hidden="true">
                            <span class="card-cat-barra" style="width: ${larguraBarra}%;"></span>
                        </div>
                    </div>
                    <div class="card-cat-metricas">
                        <p>${formatarMoeda(valorCategoria)}</p>
                        <span class="card-cat-pct">${pct}% do total</span>
                    </div>
                </div>`;
        });
    
    dashCat.innerHTML = htmlCategorias;
    desenharGrafico(totaisPorCategoria);
}

function atualizarBarraProgresso(despesas, receitas) {
    const barra = document.getElementById('barra-progresso-preenchimento');
    const texto = document.getElementById('texto-progresso');
    const legenda = document.getElementById('legenda-progresso');
    
    if (!barra || !texto || !legenda) return;
    
    if (receitas <= 0) {
        barra.style.width = '0%';
        barra.className = 'barra-progresso-preenchimento';
        texto.textContent = '0%';
        legenda.textContent = 'Sem receitas registradas';
        legenda.style.color = 'var(--texto-muted)';
        return;
    }
    
    const percentual = Math.min((despesas / receitas) * 100, 100);
    barra.style.width = percentual.toFixed(1) + '%';
    texto.textContent = percentual.toFixed(0) + '%';
    
    barra.className = 'barra-progresso-preenchimento';
    if (percentual >= 90) {
        barra.classList.add('perigo');
        legenda.textContent = `Atenção! Você já gastou ${percentual.toFixed(0)}% da receita.`;
        legenda.style.color = 'var(--perigo)';
    } else if (percentual >= 70) {
        barra.classList.add('alerta');
        legenda.textContent = `Cuidado: ${percentual.toFixed(0)}% da receita comprometida.`;
        legenda.style.color = '#ffaa00';
    } else {
        legenda.textContent = `${formatarMoeda(receitas - despesas)} disponível de ${formatarMoeda(receitas)}`;
        legenda.style.color = 'var(--texto-muted)';
    }
}

function desenharGrafico(dados) {
    const canvas = document.getElementById('graficoPizza');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const nomes = Object.keys(dados);
    const valores = Object.values(dados);

    if (!nomes.length) {
        if (meuGrafico) {
            meuGrafico.destroy();
            meuGrafico = null;
        }
        return;
    }

    const coresSolidas = nomes.map(n => infoCategoria(n).cor);
    const isLight = document.body.classList.contains('light-mode');

    if (meuGrafico) {
        meuGrafico.data.labels = nomes;
        meuGrafico.data.datasets[0].data = valores;
        meuGrafico.data.datasets[0].backgroundColor = coresSolidas;
        meuGrafico.data.datasets[0].borderColor = isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(10, 10, 20, 0.5)';
        meuGrafico.data.datasets[0].hoverBorderColor = isLight ? 'rgba(124, 58, 237, 0.4)' : 'rgba(56, 189, 248, 0.7)';
        meuGrafico.data.datasets[0].hoverOffset = 8;
        meuGrafico.options.cutout = '79%';
        meuGrafico.options.layout.padding = 8;
        meuGrafico.options.plugins.tooltip.backgroundColor = isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(10, 10, 10, 0.9)';
        meuGrafico.options.plugins.tooltip.titleColor = isLight ? '#000' : '#fff';
        meuGrafico.options.plugins.tooltip.bodyColor = isLight ? '#000' : '#fff';
        meuGrafico.options.plugins.tooltip.borderColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

        meuGrafico.update();
    } else {
        meuGrafico = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: nomes,
                datasets: [{
                    data: valores,
                    backgroundColor: coresSolidas,
                    borderWidth: 2,
                    borderColor: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(10, 10, 20, 0.5)',
                    hoverBorderWidth: 3,
                    hoverBorderColor: isLight ? 'rgba(124, 58, 237, 0.4)' : 'rgba(56, 189, 248, 0.7)',
                    hoverOffset: 8,
                    borderRadius: 10,
                    spacing: 3
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '79%',
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    easing: 'easeOutExpo'
                },
                layout: { padding: 8 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(10, 10, 10, 0.9)',
                        titleColor: isLight ? '#000' : '#fff',
                        bodyColor: isLight ? '#000' : '#fff',
                        borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return ' ' + formatarMoeda(context.raw);
                            }
                        }
                    },
                    datalabels: {
                        color: '#fff',
                        font: { weight: '800', size: 12 },
                        textShadowBlur: 4,
                        textShadowColor: 'rgba(0,0,0,0.8)',
                        formatter: (v, context) => {
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentagem = (v / total) * 100;
                            return percentagem < 8 ? null : percentagem.toFixed(0) + '%';
                        }
                    }
                }
            }
        });
    }
}

function alternarTema() { 
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('temaFinanceiro', isLight ? 'light' : 'dark');
    const btnTema = document.getElementById('btn-tema');
    btnTema.innerHTML = isLight ? SVG_LUA : SVG_SOL;
    btnTema.title = isLight ? 'Alternar Tema (Modo Escuro)' : 'Alternar Tema (Modo Claro)';
    btnTema.setAttribute('aria-label', btnTema.title);
    filtrarEAtualizar();
}

if (localStorage.getItem('temaFinanceiro') === 'light') {
    document.body.classList.add('light-mode');
    const btnTemaInit = document.getElementById('btn-tema');
    btnTemaInit.innerHTML = SVG_LUA;
    btnTemaInit.title = 'Alternar Tema (Modo Escuro)';
    btnTemaInit.setAttribute('aria-label', btnTemaInit.title);
}

document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    btn.appendChild(ripple);

    const rect = btn.getBoundingClientRect();
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;

    setTimeout(() => ripple.remove(), 600);
});

/* =========================================
   INTEGRACAO COM A INTELIGENCIA ARTIFICIAL
   ========================================= */

const btnAbrirChat = document.getElementById('btn-abrir-chat');
const containerChatIa = document.getElementById('container-chat-ia');
const btnFecharChat = document.getElementById('btn-fechar-chat');
const btnEnviarIa = document.getElementById('btn-enviar-ia');
const inputMensagemIa = document.getElementById('input-mensagem-ia');
const areaMensagens = document.getElementById('area-mensagens');
const chatStatus = document.querySelector('.chat-status');
const textoBtnIa = document.querySelector('.btn-ia-texto');

const COHERE_API_KEY = "SUA_COHERE_API_KEY";
const USA_CLOUD_FUNCTION = false;
const URL_CLOUD_FUNCTION = 'https://us-central1-monitoramento-de-gastos.cloudfunctions.net/chatIA';
const MENSAGEM_IA_ATIVA = 'Ol\u00e1! Sou sua IA financeira. Tenho acesso aos seus dados \u2014 pergunte sobre seus gastos, saldo ou pe\u00e7a dicas!';
const MENSAGEM_IA_DEMO = 'A IA está desativada nesta demonstração. Quando você quiser mostrar o recurso, adicione a chave da Cohere e recarregue a página.';

btnAbrirChat.addEventListener('click', () => {
    containerChatIa.classList.remove('chat-ia-oculto');
});

btnFecharChat.addEventListener('click', () => {
    containerChatIa.classList.add('chat-ia-oculto');
});

function adicionarMensagemNaTela(texto, remetente, idOpcional = null) {
    const divMensagem = document.createElement('div');
    divMensagem.classList.add('mensagem', remetente);
    
    if (remetente === 'ia') {
        const conteudo = document.createElement('div');
        conteudo.classList.add('mensagem-conteudo');
        conteudo.innerHTML = formatarTextoIA(texto);
        divMensagem.appendChild(conteudo);
    } else {
        divMensagem.innerHTML = escaparHTML(texto).replace(/\n/g, '<br>');
    }
    
    if (idOpcional) {
        divMensagem.id = idOpcional;
    }
    
    areaMensagens.appendChild(divMensagem);
    areaMensagens.scrollTop = areaMensagens.scrollHeight;
}

function mostrarDigitandoIA() {
    const idDigitando = 'ia-digitando-' + Date.now();
    const divMensagem = document.createElement('div');
    divMensagem.classList.add('mensagem', 'ia', 'ia-digitando');
    divMensagem.id = idDigitando;
    
    divMensagem.innerHTML = `
        <div class="mensagem-conteudo">
            <span class="dot-typing"></span>
            <span class="dot-typing"></span>
            <span class="dot-typing"></span>
        </div>`;
    
    areaMensagens.appendChild(divMensagem);
    areaMensagens.scrollTop = areaMensagens.scrollHeight;
    return idDigitando;
}

function formatarTextoIA(texto) {
    let html = escaparHTML(texto);
    html = html.replace(/\*\*(.*?)\*\*/g, '\u0000BOLD_OPEN\u0000$1\u0000BOLD_CLOSE\u0000');
    html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    html = html.replace(/\u0000BOLD_OPEN\u0000/g, '<strong>');
    html = html.replace(/\u0000BOLD_CLOSE\u0000/g, '</strong>');
    html = html.replace(/\n[-⬢]\s/g, '\n⬢ ');
    html = html.replace(/\n/g, '<br>');
    return html;
}

function iaConfigurada() {
    return USA_CLOUD_FUNCTION || (COHERE_API_KEY && COHERE_API_KEY.trim() !== '' && COHERE_API_KEY !== 'SUA_COHERE_API_KEY');
}

function resetarMensagemInicialIA() {
    const mensagemInicial = iaConfigurada() ? MENSAGEM_IA_ATIVA : MENSAGEM_IA_DEMO;
    areaMensagens.innerHTML = `
        <div class="mensagem ia">
            <div class="mensagem-conteudo">${formatarTextoIA(mensagemInicial)}</div>
        </div>`;
}

function atualizarEstadoChat() {
    const configurada = iaConfigurada();
    const online = navigator.onLine;
    const podeUsarIA = configurada && online;

    btnAbrirChat.title = !configurada
        ? 'Assistente IA em modo de demonstração'
        : online
            ? 'Abrir assistente de IA'
            : 'Assistente IA offline';
    btnAbrirChat.setAttribute('aria-label', btnAbrirChat.title);
    if (textoBtnIa) {
        textoBtnIa.textContent = configurada ? 'Assistente IA' : 'IA Demo';
    }

    if (chatStatus) {
        chatStatus.className = 'chat-status';

        if (!configurada) {
            chatStatus.textContent = '\u25cf Demo';
            chatStatus.classList.add('demo');
        } else if (!online) {
            chatStatus.textContent = '\u25cf Offline';
            chatStatus.classList.add('offline');
        } else {
            chatStatus.textContent = '\u25cf Online';
            chatStatus.classList.add('online');
        }
    }

    inputMensagemIa.disabled = !podeUsarIA;
    btnEnviarIa.disabled = !podeUsarIA;
    btnEnviarIa.setAttribute('aria-disabled', String(!podeUsarIA));
    inputMensagemIa.placeholder = !configurada
        ? 'Adicione sua chave para demonstrar a IA'
        : online
            ? 'Pergunte algo...'
            : 'Conecte-se para usar a IA';
}

function gerarContextoFinanceiro() {
    const mesSelecionado = document.getElementById('filtro-mes').value;
    const dados = mesSelecionado === "Todos" 
        ? listaAtualDeDespesas 
        : listaAtualDeDespesas.filter(i => obterMesAno(i.dataCriacao) === mesSelecionado);

    let totalReceitas = 0, totalDespesas = 0, porCategoria = {};
    const ultimosLancamentos = [];

    dados.forEach(item => {
        const tipo = item.tipo || 'saida';
        if (tipo === 'entrada') {
            totalReceitas += item.valor;
        } else {
            totalDespesas += item.valor;
            porCategoria[item.categoria] = (porCategoria[item.categoria] || 0) + item.valor;
        }
    });

    dados.slice(0, 5).forEach(item => {
        const tipo = item.tipo || 'saida';
        ultimosLancamentos.push(`${tipo === 'entrada' ? 'Receita' : 'Despesa'}: ${item.descricao} - R$ ${item.valor.toFixed(2)} (${item.categoria})`);
    });

    const saldo = totalReceitas - totalDespesas;
    const periodo = mesSelecionado === "Todos" ? "todos os meses" : mesSelecionado;

    let categorias = Object.entries(porCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`)
        .join(', ');

    return `
CONTEXTO FINANCEIRO DO USUÁRIO (período: ${periodo}):
- Receitas totais: R$ ${totalReceitas.toFixed(2)}
- Despesas totais: R$ ${totalDespesas.toFixed(2)}
- Saldo: R$ ${saldo.toFixed(2)} (${saldo >= 0 ? 'positivo' : 'NEGATIVO'})
- Gastos por categoria: ${categorias || 'nenhum'}
- \u00daltimos lan\u00e7amentos: ${ultimosLancamentos.join(' | ') || 'nenhum'}
- Total de lançamentos: ${dados.length}
`.trim();
}

let iaOcupada = false;
const COOLDOWN_IA_MS = 3000;
const MAX_HISTORICO = 20;

async function chamarAPIIA(mensagens) {
    if (USA_CLOUD_FUNCTION) {
        const resposta = await fetch(URL_CLOUD_FUNCTION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensagens })
        });
        if (!resposta.ok) throw new Error(`Erro HTTP ${resposta.status}`);
        return await resposta.json();
    } else {
        const resposta = await fetch('https://api.cohere.com/v2/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${COHERE_API_KEY}`
            },
            body: JSON.stringify({
                model: 'command-a-03-2025',
                messages: mensagens
            })
        });
        if (!resposta.ok) {
            const erroBody = await resposta.text();
            console.error("Resposta da API:", resposta.status, erroBody);
            throw new Error(`Erro HTTP ${resposta.status}`);
        }
        return await resposta.json();
    }
}

async function enviarMensagemParaIA(mensagemUsuario) {
    if (!iaConfigurada()) {
        mostrarToast("A IA está em modo de demonstração. Adicione a chave para ativá-la.", "erro");
        return;
    }

    if (!navigator.onLine) {
        mostrarToast("Você está offline. Conecte-se para usar a IA.", "erro");
        return;
    }

    if (iaOcupada) {
        mostrarToast("Aguarde alguns segundos antes de enviar outra mensagem.", "erro");
        return;
    }
    iaOcupada = true;
    setTimeout(() => { iaOcupada = false; }, COOLDOWN_IA_MS);

    const idMensagemCarregando = mostrarDigitandoIA();
    btnEnviarIa.disabled = true;
    inputMensagemIa.disabled = true;

    try {
        const contexto = gerarContextoFinanceiro();

        historicoChat.push({ role: 'user', content: mensagemUsuario });

        if (historicoChat.length > MAX_HISTORICO) {
            historicoChat = historicoChat.slice(-MAX_HISTORICO);
        }

        const mensagens = [
            {
                role: 'system',
                content: `Você é um assistente financeiro direto e educado de um aplicativo de controle de gastos. Responda de forma curta e objetiva, sempre em português do Brasil. Use negrito (**texto**) para destacar valores e informações importantes. Use os dados financeiros abaixo para personalizar suas respostas e dar conselhos específicos.\n\n${contexto}`
            },
            ...historicoChat
        ];

        const dados = await chamarAPIIA(mensagens);

        const elementoCarregando = document.getElementById(idMensagemCarregando);
        if (elementoCarregando) elementoCarregando.remove();

        if (dados.message && dados.message.content && dados.message.content.length > 0) {
            const textoResposta = dados.message.content[0].text;
            adicionarMensagemNaTela(textoResposta, 'ia');
            historicoChat.push({ role: 'assistant', content: textoResposta });
        } else {
            adicionarMensagemNaTela('Desculpe, não consegui formular uma resposta.', 'ia');
        }

    } catch (erro) {
        console.error("Erro na API da IA:", erro);
        
        const elementoCarregando = document.getElementById(idMensagemCarregando);
        if (elementoCarregando) elementoCarregando.remove();
        
        adicionarMensagemNaTela('Ops! Tive um problema para me conectar. Verifique sua conexão.', 'ia');
        
        if (historicoChat.length > 0 && historicoChat[historicoChat.length - 1].role === 'user') {
            historicoChat.pop();
        }
    } finally {
        atualizarEstadoChat();
    }
}

btnEnviarIa.addEventListener('click', () => {
    const textoUsuario = inputMensagemIa.value.trim();
    if (textoUsuario === '') return;

    adicionarMensagemNaTela(textoUsuario, 'usuario');
    inputMensagemIa.value = '';

    enviarMensagemParaIA(textoUsuario);
});

inputMensagemIa.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnEnviarIa.click();
    }
});

/* =========================================
   UI SECUNDÁRIA (SENHA E OFFLINE)
   ========================================= */

document.querySelectorAll('.btn-toggle-senha').forEach(btn => {
    btn.setAttribute('aria-label', btn.title);
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.alvo);
        if (!input) return;
        
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        const olhoAberto = btn.querySelector('.icone-olho-aberto');
        const olhoFechado = btn.querySelector('.icone-olho-fechado');
        
        olhoAberto.style.display = isPassword ? 'none' : 'block';
        olhoFechado.style.display = isPassword ? 'block' : 'none';
        
        btn.title = isPassword ? 'Ocultar senha' : 'Mostrar senha';
        btn.setAttribute('aria-label', btn.title);
    });
});

const bannerOffline = document.getElementById('banner-offline');

function atualizarStatusConexao() {
    if (!navigator.onLine) {
        bannerOffline.style.display = 'flex';
        document.body.classList.add('modo-offline');
    } else {
        bannerOffline.style.display = 'none';
        document.body.classList.remove('modo-offline');
    }

    atualizarEstadoChat();
}

window.addEventListener('online', () => {
    atualizarStatusConexao();
    mostrarToast("Conexão restabelecida!");
});

window.addEventListener('offline', () => {
    atualizarStatusConexao();
    mostrarToast("Você está offline. Dados podem não salvar.", "erro");
});

atualizarStatusConexao();

/* =========================================
   MECANISMO DE SEGURANCA: LOGOUT AUTOMATICO
   ========================================= */

const TEMPO_LIMITE_INATIVIDADE = 600000; 
let timerInatividade;

function resetarTimer() {
    if (usuarioLogado) {
        clearTimeout(timerInatividade);
        timerInatividade = setTimeout(() => {
            mostrarToast("Sessão expirada por inatividade. Faça login novamente.", "erro");
            fazerLogout(); 
        }, TEMPO_LIMITE_INATIVIDADE);
    }
}

window.addEventListener('load', resetarTimer);
document.addEventListener('mousemove', resetarTimer);
document.addEventListener('keydown', resetarTimer);
document.addEventListener('click', resetarTimer);
document.addEventListener('touchstart', resetarTimer, { passive: true });
document.addEventListener('scroll', resetarTimer, { passive: true });

/* =========================================
   TICKER DA TELA DE LOGIN - scramble animado
   ========================================= */
(function() {
    const alvos = {
        receita: { id: 'ticker-receita', min: 6000, max: 14000 },
        despesa: { id: 'ticker-despesa', min: 1500, max: 8000 },
        saldo: { id: 'ticker-saldo' }
    };

    const DIGITOS = '0123456789';

    function fmt(v) {
        return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Efeito terminal: dígitos embaralham da esquerda para direita
    // antes de "assentar" no valor final
    function scramble(el, valorFinal, durMs) {
        const textoFinal = fmt(valorFinal);
        const len = textoFinal.length;
        const totalPassos = Math.ceil(durMs / 45);
        let passo = 0;

        // cancela animação anterior se houver
        if (el._scrambleTimer) clearInterval(el._scrambleTimer);

        el._scrambleTimer = setInterval(() => {
            passo++;
            const progresso = passo / totalPassos;

            let resultado = '';
            for (let i = 0; i < len; i++) {
                const char = textoFinal[i];
                const ehDigito = /[0-9]/.test(char);
                // cada posição assenta progressivamente da esquerda para a direita
                const assentou = progresso > (i / len) * 0.9;
                if (!ehDigito || assentou) {
                    resultado += char;
                } else {
                    resultado += DIGITOS[Math.floor(Math.random() * 10)];
                }
            }
            el.textContent = resultado;

            if (passo >= totalPassos) {
                clearInterval(el._scrambleTimer);
                el._scrambleTimer = null;
                el.textContent = textoFinal;
            }
        }, 45);
    }

    // Reordena as barras do preview card com alturas aleatórias
    function atualizarBarras() {
        const barras = document.querySelectorAll('.preview-bar');
        if (!barras.length) return;
        barras.forEach(b => {
            const h = (20 + Math.random() * 75).toFixed(1);
            b.style.height = h + '%';
        });
    }

    function sortearValor(min, max) {
        return min + Math.random() * (max - min);
    }

    function ciclo() {
        const DUR = 1400;
        const novaReceita = sortearValor(alvos.receita.min, alvos.receita.max);
        const novaDespesa = sortearValor(alvos.despesa.min, alvos.despesa.max);
        const novoSaldo = novaReceita - novaDespesa;
        [
            { id: alvos.receita.id, valor: novaReceita },
            { id: alvos.despesa.id, valor: novaDespesa },
            { id: alvos.saldo.id, valor: novoSaldo }
        ].forEach(({ id, valor }) => {
            const el = document.getElementById(id);
            if (!el) return;
            scramble(el, valor, DUR);
        });
        // Sincroniza o "Saldo este mês" do preview card com o mesmo scramble
        const previewValor = document.querySelector('.preview-valor');
        if (previewValor) {
            scramble(previewValor, novoSaldo, DUR);
        }
        atualizarBarras();
    }

    // primeira execução após um breve delay, depois a cada 4s
    setTimeout(ciclo, 500);
    setInterval(ciclo, 4000);
})();
