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
    Anchor,
    Container,
    Waves
} from 'lucide-react';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    return (
        <div className="min-h-screen flex">
            <Head title="Log in" />

            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden" style={{ backgroundColor: colors.brand.primary }}>
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 animate-pulse">
                        <Ship className="w-32 h-32 text-white" />
                    </div>
                    <div className="absolute bottom-40 right-32 animate-pulse delay-1000">
                        <Container className="w-24 h-24 text-white" />
                    </div>
                    <div className="absolute top-1/2 left-1/3 animate-pulse delay-500">
                        <Anchor className="w-20 h-20 text-white" />
                    </div>
                    <div className="absolute bottom-20 left-1/4 animate-pulse delay-700">
                        <Waves className="w-28 h-28 text-white" />
                    </div>
                </div>
                
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 bg-white bg-opacity-20 rounded-2xl backdrop-blur-sm">
                                <Ship className="w-12 h-12" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold">TBS</h1>
                                <p className="text-lg text-white text-opacity-90">Container Management System</p>
                            </div>
                        </div>
                    </div>
                    
                    <h2 className="text-3xl font-bold mb-4">
                        Welcome Back
                    </h2>
                    <p className="text-xl text-white text-opacity-90 mb-8">
                        Streamline your container operations with our comprehensive management platform
                    </p>
                    
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg mt-1">
                                <Container className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Real-time Tracking</h3>
                                <p className="text-white text-opacity-80">Monitor container movements and inventory status in real-time</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg mt-1">
                                <Anchor className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Secure Operations</h3>
                                <p className="text-white text-opacity-80">Gate-in/out management with comprehensive audit trails</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg mt-1">
                                <Ship className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Efficient Workflows</h3>
                                <p className="text-white text-opacity-80">Automated booking, billing, and reporting systems</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden mb-8 text-center">
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                                <Ship className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold" style={{ color: colors.text.primary }}>FJPWL</h1>
                            </div>
                        </div>
                        <p className="text-sm" style={{ color: colors.text.secondary }}>Container Management System</p>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-3xl font-bold mb-2" style={{ color: colors.text.primary }}>
                            Sign In
                        </h2>
                        <p className="text-sm" style={{ color: colors.text.secondary }}>
                            Enter your credentials to access your account
                        </p>
                    </div>

                    {status && (
                        <div className="mb-6 p-4 rounded-lg border-2" style={{ 
                            backgroundColor: '#D1FAE5', 
                            borderColor: colors.status.success,
                            color: colors.status.success
                        }}>
                            <p className="text-sm font-medium">{status}</p>
                        </div>
                    )}

                    <Form
                        {...store.form()}
                        resetOnSuccess={['password']}
                        className="space-y-6"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="username" className="text-base font-medium">
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
                                            className="mt-2 h-12 text-base"
                                        />
                                        <InputError message={errors.username} />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label htmlFor="password" className="text-base font-medium">
                                                Password
                                            </Label>
                                            {canResetPassword && (
                                                <TextLink
                                                    href={request()}
                                                    className="text-sm font-medium"
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
                                            className="h-12 text-base"
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id="remember"
                                            name="remember"
                                            tabIndex={3}
                                        />
                                        <Label htmlFor="remember" className="text-sm font-medium cursor-pointer">
                                            Remember me
                                        </Label>
                                    </div>

                                    <ModernButton
                                        type="submit"
                                        variant="primary"
                                        className="w-full h-12 text-base font-semibold"
                                        tabIndex={4}
                                        disabled={processing}
                                        data-test="login-button"
                                    >
                                        {processing && <Spinner />}
                                        {!processing && <Ship className="w-5 h-5" />}
                                        Sign In
                                    </ModernButton>
                                </div>
                            </>
                        )}
                    </Form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t text-center">
                        <p className="text-xs" style={{ color: colors.text.secondary }}>
                            © {new Date().getFullYear()} TBS Container Management System. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
