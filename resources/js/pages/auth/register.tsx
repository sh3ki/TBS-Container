import React from 'react';
import RegisteredUserController from '@/actions/App/Http/Controllers/Auth/RegisteredUserController';
import { login } from '@/routes';
import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ModernButton } from '@/components/modern';
import { colors } from '@/lib/colors';
import { 
    Ship, 
    Container,
    Anchor,
    UserPlus,
    Mail,
    Lock,
    User
} from 'lucide-react';

export default function Register() {
    return (
        <div className="min-h-screen flex">
            <Head title="Register" />

            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ backgroundColor: colors.brand.primary }}>
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
                </div>
                
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 bg-white bg-opacity-20 rounded-2xl backdrop-blur-sm">
                                <Ship className="w-12 h-12" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold">FJPWL</h1>
                                <p className="text-lg text-white text-opacity-90">Container Management System</p>
                            </div>
                        </div>
                    </div>
                    
                    <h2 className="text-3xl font-bold mb-4">
                        Join Our Platform
                    </h2>
                    <p className="text-xl text-white text-opacity-90 mb-8">
                        Create your account and start managing containers efficiently
                    </p>
                    
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg mt-1">
                                <Container className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Complete Container Tracking</h3>
                                <p className="text-white text-opacity-80">Track all your containers from gate-in to gate-out</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg mt-1">
                                <Anchor className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Automated Workflows</h3>
                                <p className="text-white text-opacity-80">Streamline booking, billing, and reporting processes</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg mt-1">
                                <Ship className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Real-time Insights</h3>
                                <p className="text-white text-opacity-80">Access comprehensive reports and analytics</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Register Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
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
                            Create Account
                        </h2>
                        <p className="text-sm" style={{ color: colors.text.secondary }}>
                            Enter your details below to create your account
                        </p>
                    </div>

                    <Form
                        {...RegisteredUserController.store.form()}
                        resetOnSuccess={['password', 'password_confirmation']}
                        disableWhileProcessing
                        className="space-y-6"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="name" className="text-base font-medium">
                                            Full Name <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative mt-2">
                                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                id="name"
                                                type="text"
                                                required
                                                autoFocus
                                                tabIndex={1}
                                                autoComplete="name"
                                                name="name"
                                                placeholder="John Doe"
                                                className="pl-11 h-12 text-base"
                                            />
                                        </div>
                                        <InputError message={errors.name} className="mt-2" />
                                    </div>

                                    <div>
                                        <Label htmlFor="email" className="text-base font-medium">
                                            Email Address <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative mt-2">
                                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                id="email"
                                                type="email"
                                                required
                                                tabIndex={2}
                                                autoComplete="email"
                                                name="email"
                                                placeholder="john@example.com"
                                                className="pl-11 h-12 text-base"
                                            />
                                        </div>
                                        <InputError message={errors.email} className="mt-2" />
                                    </div>

                                    <div>
                                        <Label htmlFor="password" className="text-base font-medium">
                                            Password <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative mt-2">
                                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                id="password"
                                                type="password"
                                                required
                                                tabIndex={3}
                                                autoComplete="new-password"
                                                name="password"
                                                placeholder="Create a strong password"
                                                className="pl-11 h-12 text-base"
                                            />
                                        </div>
                                        <InputError message={errors.password} className="mt-2" />
                                    </div>

                                    <div>
                                        <Label htmlFor="password_confirmation" className="text-base font-medium">
                                            Confirm Password <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative mt-2">
                                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                id="password_confirmation"
                                                type="password"
                                                required
                                                tabIndex={4}
                                                autoComplete="new-password"
                                                name="password_confirmation"
                                                placeholder="Confirm your password"
                                                className="pl-11 h-12 text-base"
                                            />
                                        </div>
                                        <InputError message={errors.password_confirmation} className="mt-2" />
                                    </div>

                                    <ModernButton
                                        type="submit"
                                        variant="add"
                                        className="w-full h-12 text-base font-semibold mt-6"
                                        tabIndex={5}
                                        data-test="register-user-button"
                                    >
                                        {processing && <Spinner />}
                                        {!processing && <UserPlus className="w-5 h-5" />}
                                        Create Account
                                    </ModernButton>
                                </div>

                                <div className="text-center">
                                    <p className="text-sm" style={{ color: colors.text.secondary }}>
                                        Already have an account?{' '}
                                        <TextLink 
                                            href={login()} 
                                            tabIndex={6}
                                            className="font-semibold"
                                            style={{ color: colors.brand.primary }}
                                        >
                                            Log in
                                        </TextLink>
                                    </p>
                                </div>
                            </>
                        )}
                    </Form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t text-center">
                        <p className="text-xs" style={{ color: colors.text.secondary }}>
                            © {new Date().getFullYear()} FJPWL Container Management System. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
