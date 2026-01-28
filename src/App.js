import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  Home, LogOut, MapPin, ClipboardList, Trash2, 
  Users, MessageCircle, PlusCircle, Map as MapIcon, 
  X, Loader2, AlertCircle, Camera, Image as ImageIcon,
  Search
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
    const script = document.createElement('script');
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => {
      if (!mapInstance.current && mapRef.current) {
        mapInstance.current = window.L.map(mapRef.current).setView(initialPos, 17);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);

        if (existingMarker?.latitude) {
          window.L.marker([existingMarker.latitude, existingMarker.longitude]).addTo(mapInstance.current);
          mapInstance.current.setView([existingMarker.latitude, existingMarker.longitude], 18);
        }

        if (!existingMarker) {
          mapInstance.current.on('click', (e) => {
            const { lat, lng } = e.latlng;
            if (markerRef.current) markerRef.current.setLatLng(e.latlng);
            else markerRef.current = window.L.marker(e.latlng).addTo(mapInstance.current);
            onLocationSelect({ lat, lng });
          });
        }
      }
    };
    document.body.appendChild(script);
    return () => { if (mapInstance.current) mapInstance.current.remove(); };
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

  useEffect(() => {
    const saved = localStorage.getItem('user_data');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (user) loadItems();
  }, [user, loadItems]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    const senha = e.target.querySelector('input[type="password"]').value;

    if (!email || !senha) {
      notify('Por favor, preencha todos os campos.', 'danger');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/auth/login', { email, senha });
      const token = response.data.token;

      if (!token) {
        notify('Erro: Token não recebido do servidor.', 'danger');
        return;
      }

      // Salvar token
      localStorage.setItem('token', token);

      // Decodificar JWT para pegar informações do usuário
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userData = {
        id: payload.sub || email,
        name: email.split('@')[0],
        email: email,
        role: payload.roles?.includes('ROLE_ADMIN') ? 'admin' : 'user'
      };

      localStorage.setItem('user_data', JSON.stringify(userData));
      setUser(userData);
      setPage('dashboard');
      setAuthMode('login');
      notify('Sessão iniciada com sucesso! 🎉');
      
      // Resetar formulário
      e.target.reset();
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
    const nome = e.target.querySelector('input[placeholder="Nome Completo"]').value;
    const email = e.target.querySelector('input[type="email"]').value;
    const senha = e.target.querySelector('input[placeholder="Palavra-passe"]').value;
    const telefone = e.target.querySelector('input[placeholder="Telefone"]').value;

    if (!nome || !email || !senha || !telefone) {
      notify('Por favor, preencha todos os campos.', 'danger');
      return;
    }

    if (senha.length < 6) {
      notify('A senha deve ter no mínimo 6 caracteres.', 'danger');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/register', { nome, email, senha, telefone });
      notify('✓ Usuário registrado com sucesso! Faça login agora.', 'success');
      
      // Resetar formulário e voltar para login
      e.target.reset();
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
      userName: user.name,
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
            <button onClick={() => setPage('add')} className={`nav-link text-start py-3 px-4 rounded-3 d-flex align-items-center gap-3 fw-medium ${page === 'add' ? 'active' : 'text-dark'}`}>
              <PlusCircle size={20} /> Novo Registo
            </button>
          </nav>

          <div className="pt-4 border-top">
            <div className="d-flex align-items-center gap-3 mb-4 px-2">
              <div className="bg-light rounded-circle p-2 text-primary"><Users size={18} /></div>
              <div className="overflow-hidden">
                <p className="small fw-bold mb-0 text-truncate">{user.name}</p>
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
                            {item.imagem ? (
                              <img src={item.imagem} alt={item.titulo} className="w-100 h-100 object-fit-cover" />
                            ) : (
                              <div className="w-100 h-100 d-flex align-items-center justify-content-center text-light bg-light">
                                <ImageIcon size={48} />
                              </div>
                            )}
                            <div className={`position-absolute top-0 start-0 m-2 badge rounded-pill ${item.status === 'Perdido' ? 'bg-danger' : 'bg-success'}`}>
                              {item.status}
                            </div>
                          </div>
                          <div className="col-sm-8 d-flex flex-column">
                            <div className="card-body p-4">
                              <h5 className="fw-bold mb-2">{item.titulo}</h5>
                              <p className="text-secondary small mb-3 text-truncate-2">{item.descricao}</p>
                              
                              <div className="d-flex flex-wrap gap-3 align-items-center mt-auto border-top pt-3">
                                <div className="small text-muted d-flex align-items-center gap-1">
                                  <Users size={14} /> {item.userName}
                                </div>
                                <button 
                                  onClick={() => setSelectedMapItem(item)} 
                                  className="btn btn-link p-0 text-primary small fw-bold text-decoration-none d-flex align-items-center gap-1"
                                >
                                  <MapIcon size={14} /> Localizar
                                </button>
                              </div>
                            </div>
                            <div className="card-footer bg-white border-0 px-4 pb-4 pt-0 d-flex gap-2">
                              <button className="btn btn-light flex-grow-1 py-2 small fw-bold rounded-3">
                                <MessageCircle size={16} className="me-2" /> Contactar
                              </button>
                              {user.role === 'admin' && (
                                <button onClick={() => deleteItem(item.id)} className="btn btn-light text-danger px-3 py-2 rounded-3">
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
                  <MapPin className="text-primary" /> {selectedMapItem.name}
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedMapItem(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3 d-flex align-items-center gap-2 text-muted small">
                  <Users size={14} /> Relatado por {selectedMapItem.userName}
                </div>
                <InteractiveMap existingMarker={selectedMapItem} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
