import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, CheckCircle } from 'lucide-react';
import './Landing.css';

function Landing() {
    const navigate = useNavigate();

    return (
        <div className="landing">
            {/* Header */}
            <header className="landing-header">
                <div className="container flex-between">
                    <div className="flex gap-md">
                        <div className="logo-icon">📊</div>
                        <span className="logo-text">Portal Proyectos</span>
                    </div>
                    <nav className="flex gap-lg">
                        <a href="#caracteristicas" className="nav-link">Características</a>
                        <a href="#admin" className="nav-link">Admin</a>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="hero">
                <div className="container text-center">
                    <h1 className="hero-title fade-in">
                        Gestión de Proyectos<br />Inteligente
                    </h1>
                    <p className="hero-subtitle fade-in">
                        Plataforma completa para gestionar proyectos, equipos y documentos.<br />
                        Organice su trabajo de forma eficiente y colaborativa.
                    </p>
                    <button
                        className="btn btn-primary mt-xl fade-in"
                        onClick={() => navigate('/dashboard')}
                    >
                        Acceder al Portal
                    </button>
                </div>
            </section>

            {/* Features Section */}
            <section className="features" id="caracteristicas">
                <div className="container">
                    <h2 className="text-center mb-xl">Características Principales</h2>

                    <div className="grid grid-3">
                        <div className="feature-card card">
                            <div className="feature-icon">
                                <FileText size={32} />
                            </div>
                            <h3 className="feature-title">Gestión de Documentos</h3>
                            <p className="feature-description text-secondary">
                                Organice y acceda a todos los documentos de proyectos en un solo lugar.
                                Sistema centralizado con control de versiones.
                            </p>
                        </div>

                        <div className="feature-card card">
                            <div className="feature-icon">
                                <Users size={32} />
                            </div>
                            <h3 className="feature-title">Colaboración</h3>
                            <p className="feature-description text-secondary">
                                Trabaje en equipo con múltiples usuarios. Asignación de tareas y
                                seguimiento de responsabilidades.
                            </p>
                        </div>

                        <div className="feature-card card">
                            <div className="feature-icon">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="feature-title">Seguimiento de Proyectos</h3>
                            <p className="feature-description text-secondary">
                                Administre proyectos con tareas, plazos y estados. Visualice el
                                progreso en tiempo real.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Landing;
