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

const appCheck = initializeAppCheck(app, {
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

document.getElementById('btn-mudar-modo').addEventListener('click', alternarModoAuth);
document.getElementById('btn-sair-nav').addEventListener('click', fazerLogout);
document.getElementById('btn-tema').addEventListener('click', alternarTema);
document.getElementById('filtro-mes').addEventListener('change', filtrarEAtualizar);
document.getElementById('btn-cancelar-edicao').addEventListener('click', cancelarEdicao);

/* =========================================
   FUNÇÕES UTILITÁRIAS
   ========================================= */

function mostrarToast(msg, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span>${tipo === 'sucesso' ? '✅' : '❌'}</span> <span>${escaparHTML(msg)}</span>`;
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
    return DOMPurify.sanitize(t);
}

function infoCategoria(c) {
    const i = { 
        'Contas Fixas': { icone: '🏠', classe: 'cat-contas', cor: '#ff003c' },
        'Alimentação': { icone: '🍔', classe: 'cat-alimentacao', cor: '#39ff14' },
        'Transporte': { icone: '🚌', classe: 'cat-transporte', cor: '#00e5ff' },
        'Educação': { icone: '📚', classe: 'cat-educacao', cor: '#b500ff' },
        'Saúde': { icone: '🏋️', classe: 'cat-saude', cor: '#ff00ff' },
        'Outros': { icone: '✨', classe: 'cat-outros', cor: '#ffaa00' },
        'Salário': { icone: '💼', classe: 'cat-salario', cor: '#22c55e' },
        'Freelance': { icone: '💻', classe: 'cat-freelance', cor: '#06b6d4' },
        'Investimentos': { icone: '📈', classe: 'cat-investimentos', cor: '#8b5cf6' },
        'Vendas': { icone: '🛒', classe: 'cat-vendas', cor: '#f97316' }
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
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    const input = document.getElementById('data-lancamento');
    input.value = `${yyyy}-${mm}-${dd}`;
    
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

function cancelarEdicao() {
    idEdicao = null;
    document.getElementById('form-despesa').reset();
    
    const btnSubmit = document.getElementById('btn-submit');
    btnSubmit.innerText = "➕ Adicionar Lançamento";
    btnSubmit.style.backgroundColor = "var(--primaria)";
    
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
    
    atualizarCategoriasSelect();
    definirDataPadrao();
}

/* =========================================
   MODAL E INTERFACE
   ========================================= */

let resolverModal = null;

function abrirModal(titulo, mensagem, textoBotao = 'Confirmar') {
    return new Promise((resolve) => {
        resolverModal = resolve;
        document.getElementById('modal-titulo').textContent = titulo;
        document.getElementById('modal-mensagem').textContent = mensagem;
        document.getElementById('modal-confirmar-btn').textContent = textoBotao;
        document.getElementById('modal-confirmar').style.display = 'flex';
    });
}

document.getElementById('modal-cancelar').addEventListener('click', () => {
    document.getElementById('modal-confirmar').style.display = 'none';
    if (resolverModal) { resolverModal(false); resolverModal = null; }
});

document.getElementById('modal-confirmar-btn').addEventListener('click', () => {
    document.getElementById('modal-confirmar').style.display = 'none';
    if (resolverModal) { resolverModal(true); resolverModal = null; }
});

document.getElementById('modal-confirmar').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('modal-confirmar').style.display = 'none';
        if (resolverModal) { resolverModal(false); resolverModal = null; }
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
   AUTENTICAÇÃO E LOGIN
   ========================================= */

function alternarModoAuth() {
    modoCadastro = !modoCadastro;
    document.getElementById('msg-erro').style.display = 'none';
    document.getElementById('container-confirma-senha').style.display = modoCadastro ? 'flex' : 'none';
    document.getElementById('container-forca-senha').style.display = modoCadastro ? 'flex' : 'none';
    document.getElementById('confirma-senha').required = modoCadastro;
    document.getElementById('titulo-login').innerText = modoCadastro ? "Criar Nova Conta" : "Acesso Restrito";
    document.getElementById('btn-entrar').innerText = modoCadastro ? "Criar Conta" : "Entrar no Sistema";
    document.getElementById('btn-mudar-modo').innerText = modoCadastro ? "Já tem conta? Faça login" : "Não tem conta? Crie uma aqui";
    
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
        htmlDicas += `<span class="dica-senha ${passou ? 'completa' : 'pendente'}">${passou ? '✓' : '○'} ${c.label}</span>`;
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
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('tela-app').style.display = 'block';
        document.getElementById('btn-sair-nav').style.display = 'block';
        document.getElementById('btn-abrir-chat').style.display = 'flex';
        
        const nome = user.displayName || (user.email ? user.email.split('@')[0] : 'usuário');
        document.getElementById('nome-usuario').textContent = nome;
        const hora = new Date().getHours();
        let saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
        document.getElementById('saudacao-usuario').querySelector('h2').innerHTML = 
            `${saudacao}, <span id="nome-usuario">${escaparHTML(nome)}</span>!`;
        
        carregarBancoDeDados(user.uid); 
        resetarTimer();
    } else {
        usuarioLogado = null;
        document.getElementById('tela-login').style.display = 'flex';
        document.getElementById('tela-app').style.display = 'none';
        document.getElementById('btn-sair-nav').style.display = 'none';
        document.getElementById('btn-abrir-chat').style.display = 'none';
        document.getElementById('container-chat-ia').classList.add('chat-ia-oculto');
        
        document.getElementById('area-mensagens').innerHTML = `
            <div class="mensagem ia">
                <div class="mensagem-conteudo">Olá! Sou sua IA financeira. Tenho acesso aos seus dados — pergunte sobre seus gastos, saldo ou peça dicas! 💰</div>
            </div>`;
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
   OPERAÇÕES NO FIRESTORE
   ========================================= */

function carregarBancoDeDados(uid) {
    if (pararDeEscutarBanco) {
        pararDeEscutarBanco();
        pararDeEscutarBanco = null;
    }

    const q = query(despesasRef, where("userId", "==", uid), orderBy("dataCriacao", "desc"));
    pararDeEscutarBanco = onSnapshot(q, (snap) => {
        listaAtualDeDespesas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        listaAtualDeDespesas.sort((a, b) => {
            const dataA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : (a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0);
            const dataB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : (b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0);
            return dataB - dataA;
        });
        
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
            listaAtualDeDespesas.sort((a, b) => {
                const dataA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0;
                const dataB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0;
                return dataB - dataA;
            });
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

    if (isNaN(valorInput) || valorInput <= 0) {
        mostrarToast("Informe um valor válido e positivo.", "erro");
        btn.disabled = false;
        return;
    }

    const dados = {
        tipo: document.getElementById('tipo-lancamento').value,
        descricao: document.getElementById('descricao').value,
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
            mostrarToast(novoPago ? "Marcado como pago! ✅" : "Marcado como pendente ⏳");
            
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
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const valorData = `${yyyy}-${mm}-${dd}`;
                document.getElementById('data-lancamento').value = valorData;
                const dp = document.getElementById('data-picker-display');
                if (dp) dp.textContent = formatarDataDisplay(valorData);
            } else {
                document.getElementById('data-lancamento').value = '';
                const dp = document.getElementById('data-picker-display');
                if (dp) dp.textContent = formatarDataDisplay('');
            }
            
            const btnSubmit = document.getElementById('btn-submit');
            btnSubmit.innerText = "💾 Salvar Alterações";
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
        filtrados = filtrados.filter(i => 
            i.descricao.toLowerCase().includes(textoBusca) || 
            i.categoria.toLowerCase().includes(textoBusca) ||
            String(i.valor).includes(textoBusca)
        );
    }
    
    atualizarInterface(filtrados);
}

/* =========================================
   ATUALIZAÇÃO DE INTERFACE E GRÁFICOS
   ========================================= */

function atualizarInterface(dados) {
    const tabela = document.getElementById('tabela-corpo');
    const dashCat = document.getElementById('dashboard-categorias');
    tabela.innerHTML = ''; 
    
    if (dados.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="5" style="border: none;">
                    <div class="estado-vazio">
                        <div class="estado-vazio-icone">📝</div>
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
        
        dashCat.innerHTML = `
            <div class="estado-vazio" style="padding: 20px 10px;">
                <div class="estado-vazio-icone">📊</div>
                <p>Seus gastos por categoria aparecerão aqui.</p>
            </div>`;
        
        if (meuGrafico) { meuGrafico.destroy(); meuGrafico = null; }
        return;
    }

    let totalReceitas = 0, totalDespesas = 0, totaisPorCategoria = {};

    dados.forEach(item => {
        const tipo = item.tipo || 'saida';
        if (tipo === 'entrada') {
            totalReceitas += item.valor;
        } else {
            totalDespesas += item.valor;
            totaisPorCategoria[item.categoria] = (totaisPorCategoria[item.categoria] || 0) + item.valor;
        }

        const info = infoCategoria(item.categoria);
        const tr = document.createElement('tr');
        tr.className = item.pago ? 'linha-paga' : '';
        
        const classeCorValor = tipo === 'entrada' ? 'valor-positivo' : 'valor-negativo';
        const sinal = tipo === 'entrada' ? '+' : '-';

        let dataFormatada = '—';
        if (item.dataCriacao) {
            const d = item.dataCriacao.toDate ? item.dataCriacao.toDate() : new Date(item.dataCriacao);
            dataFormatada = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        tr.innerHTML = `
            <td data-label="Ações"><div class="acoes-container">
                <button class="btn-status ${item.pago ? 'status-pago' : 'status-pendente'}" data-id="${item.id}">${item.pago ? '✅' : '⏳'}</button>
                <button class="btn-editar" data-id="${item.id}">✏️</button>
                <button class="btn-excluir" data-id="${item.id}">🗑️</button>
            </div></td>
            <td data-label="Descrição"><strong>${escaparHTML(item.descricao)}</strong></td>
            <td data-label="Categoria"><span class="tag ${info.classe}">${tipo === 'entrada' ? '💰 Receita' : info.icone + ' ' + escaparHTML(item.categoria)}</span></td>
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

    let htmlCategorias = '';
    Object.keys(totaisPorCategoria).forEach(cat => {
        const info = infoCategoria(cat);
        const pct = totalDespesas > 0 ? ((totaisPorCategoria[cat] / totalDespesas) * 100).toFixed(1) : 0;
        htmlCategorias += `
            <div class="card-cat">
                <div class="card-cat-header">${info.icone} ${escaparHTML(cat)}</div>
                <div style="text-align: right;">
                    <p>${formatarMoeda(totaisPorCategoria[cat])}</p>
                    <span style="font-size: 11px; color: var(--texto-muted); font-weight: 600;">${pct}%</span>
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
        legenda.textContent = `⚠️ Atenção! Você já gastou ${percentual.toFixed(0)}% da receita.`;
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
    
    if (meuGrafico) meuGrafico.destroy();
    
    const nomes = Object.keys(dados);
    const valores = Object.values(dados);

    if (!nomes.length) return;

    const coresGradiente = nomes.map(n => {
        const corBase = infoCategoria(n).cor;
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, corBase); 
        gradient.addColorStop(1, corBase + '40'); 
        return gradient;
    });

    const isLight = document.body.classList.contains('light-mode');

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: nomes,
            datasets: [{
                data: valores,
                backgroundColor: coresGradiente, 
                borderWidth: 2, 
                borderColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)', 
                hoverBorderWidth: 3,
                hoverBorderColor: isLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)', 
                hoverOffset: 8, 
                borderRadius: 8, 
                spacing: 2 
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', 
            animation: {
                animateScale: true,
                animateRotate: true,
                easing: 'easeOutExpo' 
            },
            layout: { padding: 15 },
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

function alternarTema() { 
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('temaFinanceiro', isLight ? 'light' : 'dark');
    document.getElementById('btn-tema').innerHTML = isLight ? '🌙 Modo Escuro' : '☀️ Modo Claro';
    filtrarEAtualizar();
}

if (localStorage.getItem('temaFinanceiro') === 'light') {
    document.body.classList.add('light-mode');
    document.getElementById('btn-tema').innerHTML = '🌙 Modo Escuro';
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
   INTEGRAÇÃO COM A INTELIGÊNCIA ARTIFICIAL
   ========================================= */

const btnAbrirChat = document.getElementById('btn-abrir-chat');
const containerChatIa = document.getElementById('container-chat-ia');
const btnFecharChat = document.getElementById('btn-fechar-chat');
const btnEnviarIa = document.getElementById('btn-enviar-ia');
const inputMensagemIa = document.getElementById('input-mensagem-ia');
const areaMensagens = document.getElementById('area-mensagens');

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
    html = html.replace(/\n[-•]\s/g, '\n• ');
    html = html.replace(/\n/g, '<br>');
    return html;
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
- Últimos lançamentos: ${ultimosLancamentos.join(' | ') || 'nenhum'}
- Total de lançamentos: ${dados.length}
`.trim();
}

const COHERE_API_KEY = "SUA_COHERE_API_KEY";
const USA_CLOUD_FUNCTION = false; 
const URL_CLOUD_FUNCTION = 'https://us-central1-monitoramento-de-gastos.cloudfunctions.net/chatIA';

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
    if (iaOcupada) {
        mostrarToast("Aguarde alguns segundos antes de enviar outra mensagem.", "erro");
        return;
    }
    iaOcupada = true;
    setTimeout(() => { iaOcupada = false; }, COOLDOWN_IA_MS);

    const idMensagemCarregando = mostrarDigitandoIA();
    btnEnviarIa.disabled = true;

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
        btnEnviarIa.disabled = false;
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
}

window.addEventListener('online', () => {
    atualizarStatusConexao();
    mostrarToast("Conexão restabelecida! 🟢");
});

window.addEventListener('offline', () => {
    atualizarStatusConexao();
    mostrarToast("Você está offline. Dados podem não salvar.", "erro");
});

atualizarStatusConexao();

/* =========================================
   SELECT CUSTOMIZADO PARA DESKTOP
   ========================================= */

function ehDesktop() {
    return window.matchMedia('(min-width: 800px)').matches;
}

function criarCustomSelect(selectEl) {
    if (selectEl.dataset.customizado) return;
    selectEl.dataset.customizado = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('tabindex', '0');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'custom-select-label';

    const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrowSvg.setAttribute('class', 'custom-select-arrow');
    arrowSvg.setAttribute('viewBox', '0 0 24 24');
    arrowSvg.setAttribute('fill', 'none');
    arrowSvg.setAttribute('stroke', 'currentColor');
    arrowSvg.setAttribute('stroke-width', '2.5');
    arrowSvg.setAttribute('stroke-linecap', 'round');
    arrowSvg.setAttribute('stroke-linejoin', 'round');
    arrowSvg.innerHTML = '<polyline points="6 9 12 15 18 9"/>';

    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowSvg);

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
    wrapper.appendChild(selectEl);

    function sincronizarOpcoes() {
        dropdown.innerHTML = '';
        Array.from(selectEl.options).forEach(opt => {
            if (opt.disabled && opt.value === '') return;
            const div = document.createElement('div');
            div.className = 'custom-select-option';
            if (opt.value === selectEl.value) div.classList.add('selecionado');
            div.textContent = opt.textContent;
            div.dataset.valor = opt.value;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                fechar();
            });
            dropdown.appendChild(div);
        });
        atualizarLabel();
    }

    function atualizarLabel() {
        const optSelecionada = selectEl.options[selectEl.selectedIndex];
        if (!optSelecionada || (optSelecionada.disabled && optSelecionada.value === '')) {
            labelSpan.textContent = selectEl.options[0]?.textContent || 'Escolha...';
            labelSpan.classList.add('placeholder');
        } else {
            labelSpan.textContent = optSelecionada.textContent;
            labelSpan.classList.remove('placeholder');
        }
        dropdown.querySelectorAll('.custom-select-option').forEach(el => {
            el.classList.toggle('selecionado', el.dataset.valor === selectEl.value);
        });
    }

    function abrir() {
        if (!ehDesktop()) return;
        sincronizarOpcoes();
        dropdown.classList.add('visivel');
        trigger.classList.add('aberto');
    }

    function fechar() {
        dropdown.classList.remove('visivel');
        trigger.classList.remove('aberto');
    }

    function toggle(e) {
        e.stopPropagation();
        if (!ehDesktop()) {
            selectEl.style.position = '';
            selectEl.style.opacity = '';
            selectEl.style.pointerEvents = '';
            selectEl.focus();
            return;
        }
        if (dropdown.classList.contains('visivel')) {
            fechar();
        } else {
            document.querySelectorAll('.custom-select-dropdown.visivel').forEach(d => {
                d.classList.remove('visivel');
            });
            document.querySelectorAll('.custom-select-trigger.aberto').forEach(t => {
                t.classList.remove('aberto');
            });
            abrir();
        }
    }

    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); }
        if (e.key === 'Escape') fechar();
    });

    const observer = new MutationObserver(() => {
        sincronizarOpcoes();
    });
    observer.observe(selectEl, { childList: true, subtree: true, attributes: true });

    selectEl.addEventListener('change', atualizarLabel);
    sincronizarOpcoes();

    return { sincronizar: sincronizarOpcoes, fechar };
}

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-dropdown.visivel').forEach(d => {
        d.classList.remove('visivel');
    });
    document.querySelectorAll('.custom-select-trigger.aberto').forEach(t => {
        t.classList.remove('aberto');
    });
});

criarCustomSelect(document.getElementById('tipo-lancamento'));
criarCustomSelect(document.getElementById('categoria'));

/* =========================================
   MECANISMO DE SEGURANÇA: LOGOUT AUTOMÁTICO
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

window.onload = resetarTimer;
document.onmousemove = resetarTimer;
document.onkeypress = resetarTimer;
document.onclick = resetarTimer;
document.ontouchstart = resetarTimer;
document.onscroll = resetarTimer;