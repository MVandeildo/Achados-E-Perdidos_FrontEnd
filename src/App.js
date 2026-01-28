import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  Home, LogOut, MapPin, ClipboardList, Trash2, 
  Users, MessageCircle, PlusCircle, Map as MapIcon, 
  X, Loader2, AlertCircle, Camera, Image as ImageIcon,
  Search, Check
} from 'lucide-react';


/**
 * CONFIGURAÇÃO DA API
 * Centralizada para fácil manutenção
 */
const API_BASE_URL = 'http://localhost:8080/api';
const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const CAMPUS_COORDS = [-7.905470, -37.119812];

/**
 * ESTILOS EXTERNOS (Leaflet)
 */
const MapStyles = () => (
  <link 
    rel="stylesheet" 
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossOrigin=""
  />
);

/**
 * COMPONENTE: Mapa Interativo
 * Normalizado para lidar com seleção e exibição de pontos
 */
const InteractiveMap = ({ onLocationSelect, initialPos = CAMPUS_COORDS, existingMarker = null }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    // Validar initialPos
    const validPos = (Array.isArray(initialPos) && initialPos.length === 2) ? initialPos : CAMPUS_COORDS;
    
    const script = document.createElement('script');
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onerror = () => {
      console.error('Erro ao carregar Leaflet');
    };
    script.onload = () => {
      if (!window.L) {
        console.error('Leaflet não foi carregado corretamente');
        return;
      }
      
      if (!mapInstance.current && mapRef.current) {
        try {
          mapInstance.current = window.L.map(mapRef.current).setView(validPos, 17);
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);

          if (existingMarker?.latitude && existingMarker?.longitude) {
            window.L.marker([existingMarker.latitude, existingMarker.longitude]).addTo(mapInstance.current);
            mapInstance.current.setView([existingMarker.latitude, existingMarker.longitude], 18);
          }

          if (!existingMarker) {
            mapInstance.current.on('click', (e) => {
              const { lat, lng } = e.latlng;
              if (markerRef.current) markerRef.current.setLatLng(e.latlng);
              else markerRef.current = window.L.marker(e.latlng).addTo(mapInstance.current);
              if (onLocationSelect) onLocationSelect({ lat, lng });
            });
          }
        } catch (err) {
          console.error('Erro ao inicializar mapa:', err);
        }
      }
    };
    document.body.appendChild(script);
    return () => { 
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch (e) {
          console.error('Erro ao remover mapa:', e);
        }
      }
    };
  }, [existingMarker, initialPos, onLocationSelect]);

  return (
    <div className="rounded-3 border overflow-hidden shadow-sm" style={{ height: '350px' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
};

export default function App() {
  // Estados de aplicação
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' ou 'register'
  const [page, setPage] = useState('dashboard');
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [loading, setLoading] = useState(false);
  const [notif, setNotif] = useState(null);
  const [selectedMapItem, setSelectedMapItem] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState(['ROLE_ALUNO']); // Estado para roles
  const [showContactModal, setShowContactModal] = useState(false); // Modal de contato
  const [contactItem, setContactItem] = useState(null); // Item selecionado para contato
  const [messageContent, setMessageContent] = useState(''); // Conteúdo da mensagem
  const [conversas, setConversas] = useState([]); // Lista de conversas
  const [conversaSelecionada, setConversaSelecionada] = useState(null); // Conversa aberta
  const [historicoMensagens, setHistoricoMensagens] = useState([]); // Histórico da conversa
  const [editandoMapa, setEditandoMapa] = useState(false); // Estado para modo edição de mapa
  const [localizacaoTemp, setLocalizacaoTemp] = useState(null); // Localização temporária
  const [showStatusModal, setShowStatusModal] = useState(false); // Modal para alterar status
  const [itemStatusEdit, setItemStatusEdit] = useState(null); // Item sendo editado
  const [novoStatus, setNovoStatus] = useState(''); // Novo status a ser aplicado

  const notify = (msg, type = 'success') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const loadItems = useCallback(async () => {
  setLoading(true);
  try {
    const res = await api.get('/itens');
    setItems(res.data || []); 
  } catch (err) {
    notify('Falha ao sincronizar dados com o servidor.', 'danger');
  } finally {
    setLoading(false);
  }
}, []);

  const loadConversas = useCallback(async () => {
    try {
      const res = await api.get('/mensagens/minhas-mensagens');
      if (res.data) {
        // Usar apenas mensagens RECEBIDAS para evitar mostrar conversas que você iniciou
        const todas = res.data.recebidas || [];
        const convsMap = new Map();
        
        todas.forEach(msg => {
          // msg.remetente é quem enviou, msg.destinatario é você
          const outroUsuario = msg?.remetente;
          
          // Verificação de segurança: garantir que o remetente existe
          if (!outroUsuario || !outroUsuario.id) {
            console.warn('Aviso: Mensagem sem remetente válido', msg);
            return;
          }
          
          const key = outroUsuario.id;
          
          if (!convsMap.has(key)) {
            convsMap.set(key, {
              usuarioId: key,
              nomeUsuario: outroUsuario.nome || 'Desconhecido',
              ultimaMensagem: msg.conteudo || '[Mensagem vazia]',
              dataUltima: msg.dataEnvio || new Date().toISOString()
            });
          } else {
            const conv = convsMap.get(key);
            const msgDate = new Date(msg.dataEnvio || 0);
            const convDate = new Date(conv.dataUltima || 0);
            if (msgDate > convDate) {
              conv.ultimaMensagem = msg.conteudo || '[Mensagem vazia]';
              conv.dataUltima = msg.dataEnvio || new Date().toISOString();
            }
          }
        });
        
        setConversas(Array.from(convsMap.values()).sort((a, b) => 
          new Date(b.dataUltima) - new Date(a.dataUltima)
        ));
      }
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    }
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem('user_data');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (user) {
      loadItems();
      loadConversas();
    }
  }, [user, loadItems, loadConversas]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]')?.value?.trim();
    const senha = e.target.querySelector('input[type="password"]')?.value;

    if (!email || !senha) {
      notify('Por favor, preencha todos os campos.', 'danger');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/auth/login', { email, senha });
      const token = response?.data?.token;

      if (!token) {
        notify('Erro: Token não recebido do servidor.', 'danger');
        return;
      }

      // Salvar token
      localStorage.setItem('token', token);

      // Decodificar JWT para pegar informações do usuário
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userData = {
          id: payload?.sub || email,
          name: email.split('@')[0],
          email: email,
          role: payload?.roles?.includes('ROLE_ADMIN') ? 'admin' : 'user'
        };

        localStorage.setItem('user_data', JSON.stringify(userData));
        setUser(userData);
        setPage('dashboard');
        setAuthMode('login');
        notify('Sessão iniciada com sucesso! 🎉');
        
        // Resetar formulário
        e.target.reset();
      } catch (decodeErr) {
        console.error('Erro ao decodificar JWT:', decodeErr);
        notify('Erro ao processar dados de autenticação.', 'danger');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Email ou senha inválidos.';
      notify(errorMsg, 'danger');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const nome = e.target.querySelector('input[placeholder="Nome Completo"]')?.value?.trim();
    const email = e.target.querySelector('input[type="email"]')?.value?.trim();
    const senha = e.target.querySelector('input[placeholder="Palavra-passe"]')?.value;
    const telefone = e.target.querySelector('input[placeholder="Telefone"]')?.value?.trim();

    if (!nome || !email || !senha || !telefone) {
      notify('Por favor, preencha todos os campos.', 'danger');
      return;
    }

    if (selectedRoles.length === 0) {
      notify('Por favor, selecione pelo menos uma função.', 'danger');
      return;
    }

    if (senha.length < 6) {
      notify('A senha deve ter no mínimo 6 caracteres.', 'danger');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/register', { nome, email, senha, telefone, roles: selectedRoles });
      notify('✓ Usuário registrado com sucesso! Faça login agora.', 'success');
      
      // Resetar formulário e voltar para login
      e.target.reset();
      setSelectedRoles(['ROLE_ALUNO']);
      setTimeout(() => {
        setAuthMode('login');
      }, 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data || 'Erro ao registrar. Tente novamente.';
      notify(errorMsg, 'danger');
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setPage('dashboard');
    setAuthMode('login');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Limite de 5MB para a imagem
      const maxSizeMB = 5;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      
      if (file.size > maxSizeBytes) {
        notify(`Imagem muito grande! Máximo ${maxSizeMB}MB.`, 'danger');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    
    const titulo = e.target.querySelector('input[name="titulo"]').value?.trim();
    const descricao = e.target.querySelector('textarea[name="descricao"]').value?.trim();
    const status = e.target.querySelector('input[name="status"]:checked')?.value;

    if (!titulo || !descricao || !status) {
      notify('Por favor, preencha todos os campos obrigatórios.', 'danger');
      return;
    }

    // Se houver imagem muito grande em Base64, envie sem ela
    let imagem = imagePreview;
    if (imagem && imagem.length > 1000000) {
      notify('Imagem muito grande! Publicando sem foto...', 'warning');
      imagem = null;
    }

    const data = {
      titulo: titulo.substring(0, 100),
      descricao: descricao.substring(0, 5000),
      status,
      userName: user?.name || 'Usuário Desconhecido',
      imagem: imagem,
      latitude: null,
      longitude: null
    };

    try {
      setLoading(true);
      const response = await api.post('/itens', data);
      notify('✓ Item publicado com sucesso no mural! 📌');
      e.target.reset();
      setImagePreview(null);
      
      setTimeout(() => {
        setPage('dashboard');
        loadItems();
      }, 800);
    } catch (err) {
      console.error('Create item error:', err);
      
      let errorMsg = 'Erro ao publicar o registro.';
      if (err.response?.status === 400) {
        errorMsg = err.response?.data?.message || 'Dados inválidos. Verifique os campos.';
      } else if (err.response?.status === 401) {
        errorMsg = 'Sessão expirada. Faça login novamente.';
      } else if (err.response?.status === 403) {
        errorMsg = 'Você não tem permissão para publicar itens.';
      } else if (err.response?.status === 413) {
        errorMsg = 'Imagem muito grande. Tente uma menor.';
      } else if (err.response?.status >= 500) {
        errorMsg = 'Erro no servidor. Tente novamente em alguns minutos.';
      }
      
      notify(errorMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Tem certeza que deseja deletar este registro?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/itens/${id}`);
      notify('✓ Registro removido com sucesso.');
      await loadItems();
    } catch (err) {
      notify('Erro ao deletar o item.', 'danger');
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageContent.trim()) {
      notify('Por favor, escreva uma mensagem.', 'danger');
      return;
    }

    if (!contactItem) {
      notify('Erro: item não selecionado.', 'danger');
      return;
    }

    try {
      setLoading(true);
      
      // Enviar mensagem para o criador do item
      const messageData = {
        nomeDestinatario: contactItem?.userName || 'Usuário Desconhecido', // Nome de usuário do criador do item
        conteudo: `[Sobre o item "${contactItem?.titulo || 'Item Sem Título'}"]\n\n${messageContent}`
      };

      await api.post('/mensagens/enviar', messageData);
      notify('✓ Mensagem enviada com sucesso!', 'success');
      
      setMessageContent('');
      setShowContactModal(false);
      setContactItem(null);
      loadConversas(); // Recarregar conversas
    } catch (err) {
      console.error('Send message error:', err);
      const errorMsg = err.response?.data || 'Erro ao enviar mensagem. Tente novamente.';
      notify(errorMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const abrirConversa = async (conversa) => {
    setConversaSelecionada(conversa);
    try {
      const res = await api.get(`/mensagens/conversa/${conversa.usuarioId}`);
      setHistoricoMensagens(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      notify('Erro ao carregar histórico de mensagens.', 'danger');
    }
  };

  const enviarResposta = async (e) => {
    e.preventDefault();

    if (!messageContent.trim() || !conversaSelecionada) {
      notify('Por favor, escreva uma mensagem.', 'danger');
      return;
    }

    try {
      setLoading(true);
      
      const messageData = {
        nomeDestinatario: conversaSelecionada.nomeUsuario,
        conteudo: messageContent
      };

      await api.post('/mensagens/enviar', messageData);
      notify('✓ Mensagem enviada!', 'success');
      
      setMessageContent('');
      await abrirConversa(conversaSelecionada); // Recarregar conversa
      loadConversas(); // Recarregar lista
    } catch (err) {
      console.error('Send message error:', err);
      const errorMsg = err.response?.data || 'Erro ao enviar mensagem.';
      notify(errorMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const salvarLocalizacao = async () => {
    if (!localizacaoTemp || !selectedMapItem) {
      notify('Por favor, marque uma localização no mapa.', 'danger');
      return;
    }

    try {
      setLoading(true);
      
      // Enviar atualização do item com a localização
      const itemAtualizado = {
        ...selectedMapItem,
        latitude: localizacaoTemp.lat,
        longitude: localizacaoTemp.lng
      };

      await api.put(`/itens/${selectedMapItem.id}`, itemAtualizado);
      notify('✓ Localização salva com sucesso!', 'success');
      
      // Atualizar a lista de itens
      await loadItems();
      
      // Fechar o modal
      setSelectedMapItem(null);
      setEditandoMapa(false);
      setLocalizacaoTemp(null);
    } catch (err) {
      console.error('Save location error:', err);
      const errorMsg = err.response?.data?.message || 'Erro ao salvar localização.';
      notify(errorMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatusItem = async () => {
    if (!itemStatusEdit || !novoStatus) {
      notify('Por favor, selecione um status válido.', 'danger');
      return;
    }

    try {
      setLoading(true);
      
      // Atualizar o item com o novo status
      const itemAtualizado = {
        ...itemStatusEdit,
        status: novoStatus
      };

      await api.put(`/itens/${itemStatusEdit.id}`, itemAtualizado);
      notify(`✓ Status alterado para "${novoStatus}" com sucesso!`, 'success');
      
      // Atualizar a lista de itens
      await loadItems();
      
      // Fechar o modal
      setShowStatusModal(false);
      setItemStatusEdit(null);
      setNovoStatus('');
    } catch (err) {
      console.error('Update status error:', err);
      const errorMsg = err.response?.data?.message || 'Erro ao alterar status do item.';
      notify(errorMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Filtros de interface
  const itensFiltrados = items.filter(item => {
  // Filtro por texto (título)
  const matchesSearch = item.titulo?.toLowerCase().includes(searchTerm.toLowerCase());
  
  // Filtro por Status (Todos, Perdido ou Encontrado)
  const matchesStatus = filterStatus === 'Todos' || item.status === filterStatus;
  
  return matchesSearch && matchesStatus;
});

  // --- TELA DE ACESSO (LOGIN/REGISTRO) ---
  if (!user) return (
    <div className="bg-light min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="card shadow-sm border-0 rounded-4 overflow-hidden" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-inline-flex p-4 mb-3">
              <MapPin size={40} />
            </div>
            <h3 className="fw-bold">Campus Connect</h3>
            <p className="text-muted small">Achados e Perdidos IFPB</p>
          </div>

          {authMode === 'login' ? (
            <>
              <form onSubmit={handleLogin} className="d-grid gap-3">
                <input type="email" placeholder="E-mail Institucional" className="form-control py-3" required />
                <input type="password" placeholder="Palavra-passe" className="form-control py-3" required />
                <button type="submit" disabled={loading} className="btn btn-primary py-3 fw-bold shadow-sm mt-2">
                  {loading ? <Loader2 className="spinner-border spinner-border-sm me-2" /> : ''} ENTRAR
                </button>
              </form>
              <div className="text-center mt-4">
                <p className="text-muted small">Não tem conta?</p>
                <button 
                  onClick={() => setAuthMode('register')} 
                  className="btn btn-outline-primary btn-sm"
                >
                  Criar Conta
                </button>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleRegister} className="d-grid gap-3">
                <input type="text" placeholder="Nome Completo" className="form-control py-3" required />
                <input type="email" placeholder="E-mail Institucional" className="form-control py-3" required />
                <input type="tel" placeholder="Telefone" className="form-control py-3" required />
                <input type="password" placeholder="Palavra-passe" className="form-control py-3" required />
                
                {/* Seção de seleção de funções */}
                <div className="border rounded-3 p-3 bg-light">
                  <label className="fw-bold small mb-3 d-block">Selecione sua função:</label>
                  
                  <div className="form-check mb-2">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="roleAluno"
                      checked={selectedRoles.includes('ROLE_ALUNO')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, 'ROLE_ALUNO']);
                        } else {
                          setSelectedRoles(selectedRoles.filter(r => r !== 'ROLE_ALUNO'));
                        }
                      }}
                    />
                    <label className="form-check-label small" htmlFor="roleAluno">
                      Aluno
                    </label>
                  </div>

                  <div className="form-check mb-2">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="roleFuncionario"
                      checked={selectedRoles.includes('ROLE_FUNCIONARIO')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, 'ROLE_FUNCIONARIO']);
                        } else {
                          setSelectedRoles(selectedRoles.filter(r => r !== 'ROLE_FUNCIONARIO'));
                        }
                      }}
                    />
                    <label className="form-check-label small" htmlFor="roleFuncionario">
                      Funcionário
                    </label>
                  </div>

                  <div className="form-check">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="roleProfessor"
                      checked={selectedRoles.includes('ROLE_PROFESSOR')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, 'ROLE_PROFESSOR']);
                        } else {
                          setSelectedRoles(selectedRoles.filter(r => r !== 'ROLE_PROFESSOR'));
                        }
                      }}
                    />
                    <label className="form-check-label small" htmlFor="roleProfessor">
                      Professor
                    </label>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-success py-3 fw-bold shadow-sm mt-2">
                  {loading ? <Loader2 className="spinner-border spinner-border-sm me-2" /> : ''} CADASTRAR
                </button>
              </form>
              <div className="text-center mt-4">
                <p className="text-muted small">Já tem conta?</p>
                <button 
                  onClick={() => setAuthMode('login')} 
                  className="btn btn-outline-primary btn-sm"
                >
                  Voltar para Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container-fluid p-0 overflow-hidden">
      <MapStyles />
      
      {/* NOTIFICAÇÃO FLOATING */}
      {notif && (
        <div className={`position-fixed top-0 start-50 translate-middle-x mt-4 z-3 alert alert-${notif.type} shadow border-0 px-4 py-3 rounded-pill d-flex align-items-center gap-3`} style={{ minWidth: '300px' }}>
          <AlertCircle size={20} />
          <span className="fw-semibold small">{notif.msg}</span>
        </div>
      )}

      <div className="row g-0">
        {/* NAVEGAÇÃO LATERAL (SIDEBAR) */}
        <aside className="col-md-3 col-xl-2 bg-white border-end vh-100 sticky-top d-flex flex-column p-4">
          <div className="d-flex align-items-center gap-2 mb-5 px-2">
            <MapPin className="text-primary" size={28} />
            <span className="fw-bold h5 mb-0 tracking-tight">IFPB<span className="text-primary">.</span></span>
          </div>

          <nav className="nav nav-pills flex-column gap-2 mb-auto">
            <button onClick={() => setPage('dashboard')} className={`nav-link text-start py-3 px-4 rounded-3 d-flex align-items-center gap-3 fw-medium ${page === 'dashboard' ? 'active' : 'text-dark'}`}>
              <Home size={20} /> Mural
            </button>
            <button onClick={() => { setPage('messages'); loadConversas(); }} className={`nav-link text-start py-3 px-4 rounded-3 d-flex align-items-center gap-3 fw-medium ${page === 'messages' ? 'active' : 'text-dark'}`}>
              <MessageCircle size={20} /> Mensagens
            </button>
            <button onClick={() => setPage('add')} className={`nav-link text-start py-3 px-4 rounded-3 d-flex align-items-center gap-3 fw-medium ${page === 'add' ? 'active' : 'text-dark'}`}>
              <PlusCircle size={20} /> Novo Registo
            </button>
          </nav>

          <div className="pt-4 border-top">
            <div className="d-flex align-items-center gap-3 mb-4 px-2">
              <div className="bg-light rounded-circle p-2 text-primary"><Users size={18} /></div>
              <div className="overflow-hidden">
                <p className="small fw-bold mb-0 text-truncate">{user?.name || 'Usuário'}</p>
                <p className="text-muted mb-0" style={{ fontSize: '11px' }}>Utilizador Ativo</p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn btn-outline-light text-danger border-0 w-100 text-start py-3 px-4 d-flex align-items-center gap-3 fw-medium rounded-3 hover-bg-light">
              <LogOut size={18} /> Sair
            </button>
          </div>
        </aside>

        {/* CONTEÚDO PRINCIPAL */}
        <main className="col-md-9 col-xl-10 bg-light min-vh-100 p-4 p-lg-5">
          {page === 'dashboard' ? (
            <div className="container-fluid p-0">
              <div className="row mb-5 align-items-center">
                <div className="col-md-6">
                  <h2 className="fw-bold mb-1">Mural do Campus</h2>
                  <p className="text-muted small">Consulte itens perdidos ou entregues na portaria.</p>
                </div>
                <div className="col-md-6 d-flex gap-2 justify-content-md-end">
                  <div className="input-group bg-white rounded-3 shadow-sm border-0" style={{ maxWidth: '300px' }}>
                    <span className="input-group-text bg-white border-0"><Search size={18} className="text-muted" /></span>
                    <input 
                      type="text" 
                      className="form-control border-0 px-0" 
                      placeholder="Pesquisar..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select 
                    className="form-select border-0 shadow-sm rounded-3" 
                    style={{ width: '150px' }}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="Todos">Todos</option>
                    <option value="Perdido">Perdidos</option>
                    <option value="Encontrado">Encontrados</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-5">
                  <Loader2 className="spinner-border text-primary" size={40} />
                </div>
              ) : (
                <div className="row g-4">
                  {itensFiltrados.map(item => (
                    <div key={item.id} className="col-xl-6">
                      <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                        <div className="row g-0 h-100">
                          <div className="col-sm-4 bg-white position-relative" style={{ minHeight: '160px' }}>
                            {item?.imagem ? (
                              <img src={item.imagem} alt={item?.titulo || 'Item'} className="w-100 h-100 object-fit-cover" />
                            ) : (
                              <div className="w-100 h-100 d-flex align-items-center justify-content-center text-light bg-light">
                                <ImageIcon size={48} />
                              </div>
                            )}
                            <div className={`position-absolute top-0 start-0 m-2 badge rounded-pill ${item?.status === 'Perdido' ? 'bg-danger' : 'bg-success'}`}>
                              {item?.status || 'Status'}
                            </div>
                          </div>
                          <div className="col-sm-8 d-flex flex-column">
                            <div className="card-body p-4">
                              <h5 className="fw-bold mb-2">{item?.titulo || 'Título não disponível'}</h5>
                              <p className="text-secondary small mb-3 text-truncate-2">{item?.descricao || 'Sem descrição'}</p>
                              
                              <div className="d-flex flex-wrap gap-3 align-items-center mt-auto border-top pt-3">
                                <div className="small text-muted d-flex align-items-center gap-1">
                                  <Users size={14} /> {item?.userName || 'Usuário Desconhecido'}
                                </div>
                                {item?.userName === user?.name && (
                                  <button 
                                    onClick={() => {
                                      setItemStatusEdit(item);
                                      setNovoStatus(item?.status || '');
                                      setShowStatusModal(true);
                                    }}
                                    className="btn btn-link p-0 text-warning small fw-bold text-decoration-none d-flex align-items-center gap-1 ms-auto"
                                  >
                                    ✓ Marcar como {item?.status === 'Perdido' ? 'Encontrado' : 'Perdido'}
                                  </button>
                                )}
                                <button 
                                  onClick={() => {
                                    // Se é o criador do item, abrir mapa para editar localização
                                    if (item?.userName === user?.name) {
                                      setSelectedMapItem(item);
                                      setEditandoMapa(true);
                                      setLocalizacaoTemp(item?.latitude && item?.longitude ? { lat: item.latitude, lng: item.longitude } : null);
                                    } else {
                                      // Se não é criador, apenas visualizar
                                      setSelectedMapItem(item);
                                      setEditandoMapa(false);
                                    }
                                  }} 
                                  className="btn btn-link p-0 text-primary small fw-bold text-decoration-none d-flex align-items-center gap-1"
                                >
                                  <MapIcon size={14} /> Localizar
                                </button>
                              </div>
                            </div>
                            <div className="card-footer bg-white border-0 px-4 pb-4 pt-0 d-flex gap-2">
                              <button 
                                onClick={() => {
                                  setContactItem(item);
                                  setShowContactModal(true);
                                }}
                                className="btn btn-light flex-grow-1 py-2 small fw-bold rounded-3"
                              >
                                <MessageCircle size={16} className="me-2" /> Contactar
                              </button>
                              {user?.role === 'admin' && (
                                <button onClick={() => deleteItem(item?.id)} className="btn btn-light text-danger px-3 py-2 rounded-3">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {itensFiltrados.length === 0 && (
                    <div className="col-12 text-center py-5">
                      <div className="bg-white rounded-4 shadow-sm p-5 border-2 border-dashed">
                        <ClipboardList size={48} className="text-muted mb-3 opacity-25" />
                        <h5 className="text-muted fw-bold">Nenhum item encontrado</h5>
                        <p className="text-muted small">Tente ajustar a sua pesquisa ou filtros.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : page === 'messages' ? (
            /* PÁGINA DE MENSAGENS */
            <div className="container-fluid p-0">
              <div className="row h-100 g-0" style={{ minHeight: 'calc(100vh - 120px)' }}>
                {/* LISTA DE CONVERSAS */}
                <div className="col-lg-4 bg-white border-end d-flex flex-column" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                  <div className="p-4 border-bottom">
                    <h5 className="fw-bold mb-0">Minhas Mensagens</h5>
                  </div>

                  <div className="flex-grow-1 overflow-y-auto">
                    {conversas.length > 0 ? (
                      conversas.map(conversa => {
                        const nomeUsuario = conversa?.nomeUsuario || 'Desconhecido';
                        const ultimaMensagem = (conversa?.ultimaMensagem || '[Sem mensagem]').substring(0, 50);
                        const dataFormatada = conversa?.dataUltima 
                          ? new Date(conversa.dataUltima).toLocaleDateString('pt-PT')
                          : 'Sem data';
                        
                        return (
                          <div
                            key={conversa.usuarioId}
                            onClick={() => abrirConversa(conversa)}
                            className={`p-3 border-bottom cursor-pointer ${conversaSelecionada?.usuarioId === conversa.usuarioId ? 'bg-light' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="flex-grow-1">
                                <p className="fw-bold mb-1 text-truncate">{nomeUsuario}</p>
                                <p className="small text-muted mb-0 text-truncate">{ultimaMensagem}...</p>
                              </div>
                              <small className="text-muted ms-2">
                                {dataFormatada}
                              </small>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-muted">
                        <MessageCircle size={32} className="opacity-25 mb-2" />
                        <p className="small">Nenhuma conversa ainda</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ÁREA DE CONVERSA */}
                <div className="col-lg-8 d-flex flex-column bg-light" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                  {conversaSelecionada ? (
                    <>
                      {/* HEADER DA CONVERSA */}
                      <div className="p-4 bg-white border-bottom d-flex align-items-center gap-3">
                        <div>
                          <h6 className="fw-bold mb-0">{conversaSelecionada.nomeUsuario}</h6>
                          <small className="text-muted">Conversa aberta</small>
                        </div>
                        <button 
                          onClick={() => {
                            setConversaSelecionada(null);
                            setHistoricoMensagens([]);
                            setMessageContent('');
                          }}
                          className="btn btn-light ms-auto"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* HISTÓRICO DE MENSAGENS */}
                      <div className="flex-grow-1 overflow-y-auto p-4 d-flex flex-column gap-3">
                        {historicoMensagens.length > 0 ? (
                          historicoMensagens.map((msg, idx) => {
                            // Verificações de segurança para evitar undefined errors
                            const isOwnMessage = (msg?.remetente?.email && user?.email) 
                              ? msg.remetente.email === user.email 
                              : false;
                            const senderEmail = msg?.remetente?.email || 'Desconhecido';
                            const content = msg?.conteudo || '';
                            const timestamp = msg?.dataEnvio ? new Date(msg.dataEnvio).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : 'Sem hora';
                            
                            return (
                              <div
                                key={idx}
                                className={`d-flex ${isOwnMessage ? 'justify-content-end' : 'justify-content-start'}`}
                              >
                                <div
                                  className={`p-3 rounded-3 ${isOwnMessage ? 'bg-primary text-white' : 'bg-white border'}`}
                                  style={{ maxWidth: '70%', wordWrap: 'break-word' }}
                                >
                                  <p className="mb-1 small">{content}</p>
                                  <small className={isOwnMessage ? 'opacity-75' : 'text-muted'}>
                                    {timestamp}
                                  </small>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center text-muted py-5">
                            <MessageCircle size={48} className="opacity-25 mb-2" />
                            <p>Nenhuma mensagem nesta conversa</p>
                          </div>
                        )}
                      </div>

                      {/* INPUT DE MENSAGEM */}
                      <div className="p-4 bg-white border-top">
                        <form onSubmit={enviarResposta} className="d-flex gap-2">
                          <textarea
                            className="form-control rounded-3"
                            rows="2"
                            maxLength="1000"
                            placeholder="Escreva sua mensagem..."
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            style={{ resize: 'none' }}
                          />
                          <button
                            type="submit"
                            disabled={loading || !messageContent.trim()}
                            className="btn btn-primary rounded-3 px-4"
                          >
                            {loading ? <Loader2 size={18} /> : <MessageCircle size={18} />}
                          </button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                      <div className="text-center">
                        <MessageCircle size={64} className="opacity-25 mb-3" />
                        <p className="fw-bold">Selecione uma conversa para começar</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* FORMULÁRIO DE REGISTO */
            <div className="row justify-content-center">
              <div className="col-lg-8 col-xl-6">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body p-4 p-lg-5">
                    <header className="mb-4">
                      <h3 className="fw-bold mb-1">Novo Registo</h3>
                      <p className="text-muted small">Preencha os detalhes para ajudar a comunidade.</p>
                    </header>

                    <form onSubmit={handleCreateSubmit} className="row g-4">
                      <div className="col-12">
                        <div className="bg-light p-2 rounded-3 d-flex gap-2">
                          <input type="radio" className="btn-check" name="status" id="stLost" value="Perdido" defaultChecked />
                          <label className="btn btn-outline-primary border-0 rounded-3 flex-fill py-3 fw-bold" htmlFor="stLost">PERDI ALGO</label>
                          <input type="radio" className="btn-check" name="status" id="stFound" value="Encontrado" />
                          <label className="btn btn-outline-primary border-0 rounded-3 flex-fill py-3 fw-bold" htmlFor="stFound">ACHEI ALGO</label>
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="d-flex align-items-center justify-content-center bg-light rounded-4 border-2 border-dashed position-relative" style={{ height: '220px', overflow: 'hidden' }}>
                          {imagePreview ? (
                            <>
                              <img src={imagePreview} className="w-100 h-100 object-fit-cover" alt="Preview" />
                              <button type="button" onClick={() => setImagePreview(null)} className="btn btn-danger btn-sm position-absolute top-0 end-0 m-3 rounded-circle">
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <div className="text-center">
                              <input type="file" accept="image/*" onChange={handleImageChange} className="position-absolute inset-0 opacity-0 cursor-pointer" />
                              <Camera size={32} className="text-muted mb-2" />
                              <p className="small fw-bold text-muted mb-0">ANEXAR FOTO DO ITEM</p>
                              <p className="text-muted" style={{ fontSize: '10px' }}>Opcional, mas recomendado.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-12">
                        <label className="form-label fw-bold small text-muted text-uppercase">O que é?</label>
                        <input name="titulo" className="form-control py-3" placeholder="Ex: Chaves, iPhone 13, Mochila Preta..." required />
                      </div>

                      <div className="col-12">
                        <label className="form-label fw-bold small text-muted text-uppercase">Descrição/Detalhes</label>
                        <textarea name="descricao" className="form-control py-3" rows="3" placeholder="Onde foi visto? Tem algum adesivo ou marca?" required></textarea>
                      </div>

                      <div className="col-12 pt-2">
                        <button type="submit" className="btn btn-primary btn-lg w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2">
                          <PlusCircle size={20} /> PUBLICAR REGISTRO
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL DE MAPA (BOOTSTRAP) */}
      {selectedMapItem && (
        <div className="modal show d-block bg-dark bg-opacity-75 animate-fade-in" tabIndex="-1" style={{ zIndex: 10000 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-0 p-4 pb-0">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <MapPin className="text-primary" /> {selectedMapItem.titulo}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setSelectedMapItem(null);
                    setEditandoMapa(false);
                    setLocalizacaoTemp(null);
                  }}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3 d-flex align-items-center gap-2 text-muted small">
                  <Users size={14} /> Relatado por {selectedMapItem.userName}
                </div>

                {editandoMapa ? (
                  <>
                    <InteractiveMap 
                      onLocationSelect={setLocalizacaoTemp}
                      initialPos={localizacaoTemp ? [localizacaoTemp.lat, localizacaoTemp.lng] : CAMPUS_COORDS}
                    />
                    <div className="mt-3 text-center small text-muted">
                      <p>Clique no mapa para marcar a localização onde você achou o item</p>
                    </div>
                  </>
                ) : (
                  <InteractiveMap 
                    existingMarker={
                      selectedMapItem?.latitude && selectedMapItem?.longitude
                        ? { latitude: selectedMapItem.latitude, longitude: selectedMapItem.longitude }
                        : null
                    } 
                  />
                )}
              </div>

              {editandoMapa && (
                <div className="modal-footer border-0 p-4 gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setSelectedMapItem(null);
                      setEditandoMapa(false);
                      setLocalizacaoTemp(null);
                    }}
                    className="btn btn-light rounded-3"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    onClick={salvarLocalizacao}
                    disabled={loading || !localizacaoTemp}
                    className="btn btn-primary rounded-3"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="spinner-border spinner-border-sm me-2" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <MapPin size={16} className="me-2" />
                        Salvar Localização
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONTATO */}
      {showContactModal && contactItem && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div className="card border-0 rounded-4 shadow-lg" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center p-4 rounded-top-4">
              <h5 className="mb-0 fw-bold">Contactar sobre "{contactItem?.titulo || 'Item Sem Título'}"</h5>
              <button 
                type="button" 
                onClick={() => {
                  setShowContactModal(false);
                  setContactItem(null);
                  setMessageContent('');
                }}
                className="btn btn-link text-white text-decoration-none"
              >
                <X size={24} />
              </button>
            </div>

            <div className="card-body p-4">
              <form onSubmit={handleSendMessage} className="d-grid gap-3">
                {/* Info do item */}
                <div className="bg-light p-3 rounded-3 border-start border-4 border-primary">
                  <p className="small text-muted mb-1">Sobre o item:</p>
                  <p className="fw-bold mb-0">{contactItem?.titulo || 'Item Sem Título'}</p>
                  <div className="d-flex gap-2 align-items-center mt-2">
                    <span className={`badge rounded-pill ${contactItem?.status === 'Perdido' ? 'bg-danger' : 'bg-success'}`}>
                      {contactItem?.status || 'Status Desconhecido'}
                    </span>
                    <span className="small text-muted">
                      <Users size={14} className="me-1" />
                      {contactItem?.userName || 'Usuário Desconhecido'}
                    </span>
                  </div>
                </div>

                {/* Textarea para mensagem */}
                <div>
                  <label className="form-label fw-bold small mb-2">Sua Mensagem:</label>
                  <textarea
                    className="form-control rounded-3"
                    rows="4"
                    maxLength="1000"
                    placeholder="Escreva sua mensagem aqui... (ex: Tenho informações sobre este item, gostaria de falar com você)"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    autoFocus
                  />
                  <small className="text-muted d-block mt-2">
                    {messageContent.length}/1000 caracteres
                  </small>
                </div>

                {/* Botões */}
                <div className="d-grid gap-2 pt-2">
                  <button 
                    type="submit" 
                    disabled={loading || !messageContent.trim()}
                    className="btn btn-primary py-3 fw-bold rounded-3"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="spinner-border spinner-border-sm me-2" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <MessageCircle size={16} className="me-2" />
                        Enviar Mensagem
                      </>
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowContactModal(false);
                      setContactItem(null);
                      setMessageContent('');
                    }}
                    className="btn btn-light py-3 rounded-3"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALTERAÇÃO DE STATUS */}
      {showStatusModal && itemStatusEdit && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div className="card border-0 rounded-4 shadow-lg" style={{ maxWidth: '450px', width: '100%' }}>
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center p-4 rounded-top-4">
              <h5 className="mb-0 fw-bold">Alterar Status do Item</h5>
              <button 
                type="button" 
                onClick={() => {
                  setShowStatusModal(false);
                  setItemStatusEdit(null);
                  setNovoStatus('');
                }}
                className="btn btn-link text-white text-decoration-none"
              >
                <X size={24} />
              </button>
            </div>

            <div className="card-body p-4">
              {/* Info do item */}
              <div className="bg-light p-3 rounded-3 border-start border-4 border-primary mb-4">
                <p className="small text-muted mb-1">Item:</p>
                <p className="fw-bold mb-2">{itemStatusEdit?.titulo || 'Item Sem Título'}</p>
                <div className="d-flex gap-2 align-items-center">
                  <span className={`badge rounded-pill ${itemStatusEdit?.status === 'Perdido' ? 'bg-danger' : 'bg-success'}`}>
                    Status Atual: {itemStatusEdit?.status || 'Status'}
                  </span>
                </div>
              </div>

              {/* Seleção de novo status */}
              <div className="mb-4">
                <label className="form-label fw-bold small mb-3">Novo Status:</label>
                <div className="d-flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNovoStatus('Perdido')}
                    className={`flex-grow-1 py-3 px-3 rounded-3 fw-bold border-2 transition ${
                      novoStatus === 'Perdido'
                        ? 'bg-danger bg-opacity-10 border-danger text-danger'
                        : 'bg-light border-light text-muted'
                    }`}
                  >
                    Perdido
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovoStatus('Encontrado')}
                    className={`flex-grow-1 py-3 px-3 rounded-3 fw-bold border-2 transition ${
                      novoStatus === 'Encontrado'
                        ? 'bg-success bg-opacity-10 border-success text-success'
                        : 'bg-light border-light text-muted'
                    }`}
                  >
                    Encontrado
                  </button>
                </div>
              </div>

              {/* Mensagem de confirmação */}
              <div className="alert alert-info d-flex gap-2 align-items-start py-3 mb-0">
                <AlertCircle size={18} className="flex-shrink-0 mt-1" />
                <div>
                  <p className="small mb-0">
                    {novoStatus === 'Encontrado' 
                      ? '✓ Você marcará este item como Encontrado. Outros usuários poderão ver essa mudança.'
                      : novoStatus === 'Perdido'
                      ? '! Você marcará este item como Perdido novamente.'
                      : 'Selecione um novo status acima.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="card-footer bg-white border-0 px-4 py-4 d-flex gap-2">
              <button 
                type="button" 
                onClick={() => {
                  setShowStatusModal(false);
                  setItemStatusEdit(null);
                  setNovoStatus('');
                }}
                className="btn btn-light py-2 px-4 rounded-3 flex-grow-1"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={atualizarStatusItem}
                disabled={loading || !novoStatus || novoStatus === itemStatusEdit?.status}
                className="btn btn-primary py-2 px-4 rounded-3 flex-grow-1 fw-bold"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spinner-border spinner-border-sm me-2" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <Check size={16} className="me-2" />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


