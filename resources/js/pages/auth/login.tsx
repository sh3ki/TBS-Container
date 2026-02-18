import React from 'react';
import { Head, Form } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { ModernButton } from '@/components/modern';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import { colors } from '@/lib/colors';
import { 
    Ship, 
    Container,
    Package,
    TruckIcon,
    ShieldCheck,
    BarChart3,
    Lock
} from 'lucide-react';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    return (
        <div className="min-h-screen flex">
            <Head title="Log in" />

            {/* Left Side - Branding with Container Theme */}
            <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden" style={{ 
                background: `linear-gradient(135deg, ${colors.brand.primary} 0%, #1e5a8e 100%)`
            }}>
                {/* Animated Background Pattern */}
                <div className="absolute inset-0">
                    {/* Container Stack Illustration */}
                    <div className="absolute top-16 left-12 opacity-20">
                        <div className="flex gap-1">
                            <div className="w-20 h-16 border-2 border-white rounded"></div>
                            <div className="w-20 h-16 border-2 border-white rounded"></div>
                            <div className="w-20 h-16 border-2 border-white rounded"></div>
                        </div>
                        <div className="flex gap-1 -mt-8 ml-10">
                            <div className="w-20 h-16 border-2 border-white rounded"></div>
                            <div className="w-20 h-16 border-2 border-white rounded"></div>
                        </div>
                    </div>
                    
                    {/* Floating Icons */}
                    <div className="absolute top-1/4 right-24 animate-float opacity-15">
                        <Ship className="w-40 h-40 text-white" />
                    </div>
                    <div className="absolute bottom-32 left-1/4 animate-float-delay opacity-15" style={{ animationDelay: '1s' }}>
                        <Container className="w-32 h-32 text-white" />
                    </div>
                    <div className="absolute top-1/2 right-1/3 animate-float-delay opacity-15" style={{ animationDelay: '2s' }}>
                        <Package className="w-28 h-28 text-white" />
                    </div>
                    <div className="absolute bottom-1/4 right-16 animate-float opacity-15" style={{ animationDelay: '1.5s' }}>
                        <TruckIcon className="w-36 h-36 text-white" />
                    </div>
                    
                    {/* Wave Pattern at Bottom */}
                    <div className="absolute bottom-0 left-0 right-0 opacity-10">
                        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-24">
                            <path d="M0,50 C300,100 600,0 900,50 C1050,75 1150,50 1200,50 L1200,120 L0,120 Z" fill="white"></path>
                        </svg>
                    </div>
                </div>
                
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    {/* Logo and Title */}
                    <div className="mb-12">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-white opacity-30 blur-xl rounded-3xl"></div>
                                <div className="relative p-5 bg-white bg-opacity-25 rounded-3xl backdrop-blur-md border border-white border-opacity-40">
                                    <img 
                                        src="/apple-touch-icon.png" 
                                        alt="TBS Logo" 
                                        className="w-16 h-16"
                                    />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-5xl font-bold tracking-tight">TBS</h1>
                                <p className="text-xl text-white text-opacity-95 font-medium">Container Management System</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mb-10">
                        <h2 className="text-4xl font-bold mb-4 leading-tight">
                            Welcome Back
                        </h2>
                        <p className="text-xl text-white text-opacity-95 leading-relaxed max-w-lg">
                            Streamline your container operations with our comprehensive management platform
                        </p>
                    </div>
                    
                    {/* Feature Cards */}
                    <div className="space-y-5 max-w-xl">
                        <div className="flex items-start gap-4 p-4 rounded-xl  transition-all duration-300">
                            <div className="p-3 bg-opacity-25 rounded-xl mt-0.5">
                                <Container className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg mb-1 text-white">Real-time Tracking</h3>
                                <p className="text-white text-opacity-90 text-sm leading-relaxed">Monitor container movements and inventory status in real-time</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-xl  transition-all duration-300">
                            <div className="p-3  bg-opacity-25 rounded-xl mt-0.5">
                                <ShieldCheck className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg mb-1 text-white">Secure Operations</h3>
                                <p className="text-white text-opacity-90 text-sm leading-relaxed">Gate-in/out management with comprehensive audit trails</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-xl  transition-all duration-300">
                            <div className="p-3  bg-opacity-25 rounded-xl mt-0.5">
                                <BarChart3 className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg mb-1 text-white">Efficient Workflows</h3>
                                <p className="text-white text-opacity-90 text-sm leading-relaxed">Automated booking, billing, and reporting systems</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-white">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden mb-10 text-center">
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <div className="relative">
                                <div className="absolute inset-0 blur-xl opacity-30" style={{ backgroundColor: colors.brand.primary }}></div>
                                <div className="relative p-4 rounded-2xl shadow-lg" style={{ backgroundColor: colors.brand.primary }}>
                                    <img 
                                        src="/apple-touch-icon.png" 
                                        alt="TBS Logo" 
                                        className="w-12 h-12"
                                    />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>TBS</h1>
                                <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>Container Management</p>
                            </div>
                        </div>
                    </div>

                    {/* Header */}
                    <div className="mb-8">
                        <h2 className="text-4xl font-bold mb-3" style={{ color: colors.text.primary }}>
                            Sign In
                        </h2>
                        <p className="text-base" style={{ color: colors.text.secondary }}>
                            Enter your credentials to access your account
                        </p>
                    </div>

                    {status && (
                        <div className="mb-6 p-4 rounded-xl border-2 shadow-sm" style={{ 
                            backgroundColor: '#D1FAE5', 
                            borderColor: colors.status.success,
                            color: colors.status.success
                        }}>
                            <p className="text-sm font-medium">{status}</p>
                        </div>
                    )}

                    <Form
                        action={store.url()}
                        method="post"
                        resetOnSuccess={['password']}
                        className="space-y-6"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="space-y-5">
                                    <div>
                                        <Label htmlFor="username" className="text-base font-semibold mb-2 block" style={{ color: colors.text.primary }}>
                                            Username
                                        </Label>
                                        <Input
                                            id="username"
                                            type="text"
                                            name="username"
                                            required
                                            autoFocus
                                            tabIndex={1}
                                            autoComplete="username"
                                            placeholder="Enter your username"
                                            className="mt-1 h-13 text-base border-2 focus:border-opacity-100 transition-all duration-200 rounded-xl"
                                        />
                                        <InputError message={errors.username} />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label htmlFor="password" className="text-base font-semibold" style={{ color: colors.text.primary }}>
                                                Password
                                            </Label>
                                            {canResetPassword && (
                                                <TextLink
                                                    href={request()}
                                                    className="text-sm font-semibold hover:underline"
                                                    style={{ color: colors.brand.primary }}
                                                    tabIndex={5}
                                                >
                                                    Forgot password?
                                                </TextLink>
                                            )}
                                        </div>
                                        <Input
                                            id="password"
                                            type="password"
                                            name="password"
                                            required
                                            tabIndex={2}
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            className="h-13 text-base border-2 focus:border-opacity-100 transition-all duration-200 rounded-xl"
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="flex items-center space-x-3 pt-1">
                                        <Checkbox
                                            id="remember"
                                            name="remember"
                                            tabIndex={3}
                                            className="w-5 h-5"
                                        />
                                        <Label htmlFor="remember" className="text-sm font-medium cursor-pointer" style={{ color: colors.text.secondary }}>
                                            Remember me
                                        </Label>
                                    </div>

                                    <div className="pt-2">
                                        <ModernButton
                                            type="submit"
                                            variant="primary"
                                            className="w-full h-14 text-base font-bold shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                                            tabIndex={4}
                                            disabled={processing}
                                            data-test="login-button"
                                        >
                                            {processing && <Spinner className="w-5 h-5" />}
                                            {!processing && <Lock className="w-5 h-5" />}
                                            Sign In
                                        </ModernButton>
                                    </div>

                                    {/* Security Badge */}
                                    <div className="pt-4">
                                        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
                                            <ShieldCheck className="w-5 h-5" style={{ color: colors.status.success }} />
                                            <span className="text-xs font-medium" style={{ color: colors.text.secondary }}>
                                                Secure connection with encrypted data transmission
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </Form>

                    {/* Footer */}
                    <div className="mt-10 pt-6 border-t border-gray-200 text-center">
                        <p className="text-xs font-medium" style={{ color: colors.text.secondary }}>
                            © {new Date().getFullYear()} TBS Container Management System. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
