import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Auth.css';

export function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            navigate('/dashboard');
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card card">
                <h2 className="text-center mb-lg">Iniciar Sesión</h2>

                {error && (
                    <div className="error-message mb-md">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="tu@email.com"
                        />
                    </div>

                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={loading}
                    >
                        {loading ? 'Cargando...' : 'Entrar'}
                    </button>
                </form>

                <p className="text-center mt-md text-secondary">
                    ¿No tienes cuenta? <Link to="/register" className="text-primary">Regístrate</Link>
                </p>
            </div>
        </div>
    );
}

export function Register() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [confirmationSent, setConfirmationSent] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            });

            if (error) throw error;

            if (data.session) {
                // Email confirmation is disabled, user is logged in automatically
                navigate('/dashboard');
                return;
            }

            // No session was returned. This happens when email confirmation is
            // enabled, but also when the account already exists (Supabase hides
            // that for security). Try signing in directly: if confirmation is
            // disabled this succeeds and we go straight to the dashboard.
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (loginData?.session) {
                navigate('/dashboard');
                return;
            }

            // Login failed. Only show the "confirm your email" screen when that
            // is genuinely the reason; otherwise surface the real error.
            if (loginError && /confirm/i.test(loginError.message)) {
                setConfirmationSent(true);
            } else {
                setError(loginError?.message || 'No se pudo iniciar sesión. Verifica tu email y contraseña.');
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (confirmationSent) {
        return (
            <div className="auth-container">
                <div className="auth-card card text-center">
                    <h2 className="mb-lg">Confirma tu email</h2>
                    <p className="mb-md text-secondary">
                        Te enviamos un correo de confirmación a <strong>{email}</strong>.
                        Por favor revisa tu bandeja de entrada (y la carpeta de spam) y haz
                        clic en el enlace para activar tu cuenta.
                    </p>
                    <p className="text-center mt-md text-secondary">
                        Una vez confirmado, <Link to="/login" className="text-primary">Inicia Sesión</Link>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card card">
                <h2 className="text-center mb-lg">Crear Cuenta</h2>

                {error && (
                    <div className="error-message mb-md">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister}>
                    <div className="form-group">
                        <label>Nombre Completo</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            placeholder="Juan Pérez"
                        />
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="tu@email.com"
                        />
                    </div>

                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={loading}
                    >
                        {loading ? 'Creando cuenta...' : 'Registrarse'}
                    </button>
                </form>

                <p className="text-center mt-md text-secondary">
                    ¿Ya tienes cuenta? <Link to="/login" className="text-primary">Inicia Sesión</Link>
                </p>
            </div>
        </div>
    );
}
