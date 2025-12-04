import logo from './logo.svg';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { useState } from 'react';

export default function App(){
  return(
    <Router>
        <Routes>
          <Route path='/' element={<Login />} />
          <Route path='/home' element={<Home />} />
          <Route path='/cadastro-item' element={<CadastroItem />} />
          <Route path='/cadastro-usuario' element={<CadastroUsuario />} />
        </Routes>
    </Router>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card p-4 shadow" style={{ width: "22rem" }}>
        <h2 className="text-center mb-3">Login</h2>
        <input type="email" className="form-control mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="form-control mb-3" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />

        <Link to="/home" className="btn btn-primary w-100">Entrar</Link>
        <Link to="/cadastro-usuario" className='btn btn-primary w-100'>Registrar-se</Link>
      </div>
    </div>
  );
}

function NavBar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary px-3">
      <Link className="navbar-brand" to="/">Achados e Perdidos</Link>
      <div className="navbar-nav gap-3">
        <Link className="nav-link" to="/home">Início</Link>
        <Link className="nav-link" to="/cadastro-item">Cadastrar Item</Link>
      </div>
    </nav>
  );
}

function Home() {
  return (
    <div>
      <NavBar />
      <div className="container mt-4">
        <h2>Bem-vindo ao Achados e Perdidos</h2>
        <p>Selecione uma opção no menu acima.</p>
      </div>
    </div>
  );
}

function CadastroItem() {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  return (
    <div>
      <NavBar />
      <div className="container mt-4">
        <div className="card p-4 shadow">
          <h3>Cadastro de Item</h3>
          <input type="text" className="form-control mb-3" placeholder="Nome do item" value={nome} onChange={(e) => setNome(e.target.value)} />
          <textarea className="form-control mb-3" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <button className="btn btn-success w-100">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function CadastroUsuario() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  return (
    <div>
      <NavBar />
      <div className="container mt-4">
        <div className="card p-4 shadow">
          <h3>Cadastro de Usuário</h3>
          <input type="text" className="form-control mb-3" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input type="email" className="form-control mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" className="form-control mb-3" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button className="btn btn-primary w-100">Cadastrar</button>
        </div>
      </div>
    </div>
  );
}