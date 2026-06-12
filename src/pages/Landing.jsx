import React from 'react';
import { useNavigate } from 'react-router-dom';
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
        </div>
    );
}

export default Landing;
