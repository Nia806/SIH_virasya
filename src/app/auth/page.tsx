"use client";

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User, Store, ArrowRight, ArrowLeft, ShieldCheck, 
  Loader2, Eye, EyeOff, Mail, Lock, CheckCircle2, 
  KeyRound, Sparkles 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore } from '@/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'google-role-select';
type UserRole = 'artisan' | 'buyer';

function AuthContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const initialRole = (searchParams.get('role') as UserRole) || 'artisan';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Password reset state
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Pending Google user needing role assignment
  const [pendingGoogleUser, setPendingGoogleUser] = useState<FirebaseUser | null>(null);

  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // Helper to map Firebase Auth error codes to user-friendly messages
  const getErrorMessage = (error: any): string => {
    switch (error?.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Incorrect email or password. Please verify your credentials or reset your password.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please sign up first.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Access temporarily locked due to multiple failed attempts. Please reset your password or try again later.';
      case 'auth/popup-closed-by-user':
        return 'Sign in was cancelled.';
      case 'auth/cancelled-popup-request':
        return 'Only one popup request allowed at a time.';
      default:
        return error?.message || 'An unexpected error occurred. Please try again.';
    }
  };

  // Create or sync user profile in Firestore
  const syncUserProfile = async (user: FirebaseUser, assignedRole: UserRole, customName?: string) => {
    if (!db) return null;
    const userRef = doc(db, 'userProfiles', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data();
    }

    const newProfile = {
      id: user.uid,
      name: customName || user.displayName || 'Virasya Member',
      email: user.email,
      role: assignedRole,
      location: 'Not Specified',
      preferredLanguage: 'en',
      profilePhotoUrl: user.photoURL || `https://picsum.photos/seed/${user.uid}/200/200`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    return newProfile;
  };

  // Route user based on their profile role
  const routeUserByRole = (userRole?: string) => {
    if (userRole === 'artisan') {
      router.push('/dashboard');
    } else {
      router.push('/marketplace');
    }
  };

  // Sign In with Email & Password
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    if (!email.trim() || !password) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Please enter both your email and password.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Retrieve profile to find role
      const userRef = doc(db, 'userProfiles', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const profileData = userSnap.data();
        toast({
          title: 'Welcome Back',
          description: `Signed in as ${profileData.name || user.email}`,
        });
        routeUserByRole(profileData.role);
      } else {
        // In case an old account exists in Auth without a Firestore profile
        const newProfile = await syncUserProfile(user, 'buyer');
        toast({
          title: 'Welcome to Virasya',
          description: 'Account signed in successfully.',
        });
        routeUserByRole(newProfile?.role);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up with Email & Password
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Full Name Required',
        description: 'Please enter your full name.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Weak Password',
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await syncUserProfile(userCredential.user, role, name.trim());

      toast({
        title: 'Account Created',
        description: `Welcome to Virasya! Registered as ${role === 'artisan' ? 'an Artisan' : 'a Buyer'}.`,
      });
      routeUserByRole(role);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In (Smart Dual-Mode)
  const handleGoogleAuth = async () => {
    if (!auth || !db) return;
    setIsLoading(true);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user already exists
      const userRef = doc(db, 'userProfiles', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const profile = userSnap.data();
        toast({
          title: 'Welcome Back',
          description: `Signed in as ${profile.name || user.displayName || user.email}`,
        });
        routeUserByRole(profile.role);
      } else {
        // User is brand new.
        if (mode === 'signup') {
          // In Sign Up mode, they already picked a role
          await syncUserProfile(user, role, user.displayName || name || undefined);
          toast({
            title: 'Welcome to Virasya',
            description: `Registered as ${role === 'artisan' ? 'an Artisan' : 'a Buyer'}.`,
          });
          routeUserByRole(role);
        } else {
          // If signing in for the first time via Google without a prior role, prompt once
          setPendingGoogleUser(user);
          setMode('google-role-select');
        }
      }
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: 'Google Sign In Failed',
          description: getErrorMessage(error),
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Finalize Google role selection for first-time signin
  const handleFinalizeGoogleRole = async (chosenRole: UserRole) => {
    if (!pendingGoogleUser) return;
    setIsLoading(true);
    try {
      await syncUserProfile(pendingGoogleUser, chosenRole);
      toast({
        title: 'Welcome to Virasya',
        description: `Profile set up as ${chosenRole === 'artisan' ? 'an Artisan' : 'a Buyer'}.`,
      });
      routeUserByRole(chosenRole);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Setup Failed',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password submission
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail) {
      toast({
        variant: 'destructive',
        title: 'Email Required',
        description: 'Please enter your account email address.',
      });
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setResetEmailSent(true);
      toast({
        title: 'Reset Link Sent',
        description: `Instructions have been sent to ${targetEmail}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Password Reset Failed',
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col paper-texture items-center justify-center p-4 py-12">
      {/* Brand Header */}
      <div className="max-w-md w-full text-center mb-6">
        <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
          <span className="text-4xl font-headline font-bold text-primary tracking-tight">Virasya</span>
        </Link>
        <p className="text-sm text-muted-foreground mt-1">
          Where Heritage Craft Meets Cultural Authenticity
        </p>
      </div>

      {/* Main Container Card */}
      <Card className="max-w-md w-full border-border/60 shadow-xl rounded-[32px] bg-white overflow-hidden p-6 sm:p-8">
        
        {/* VIEW 1: FORGOT PASSWORD */}
        {mode === 'forgot-password' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setMode('signin');
                  setResetEmailSent(false);
                }}
                className="rounded-full gap-1 px-3 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Sign In
              </Button>
            </div>

            {!resetEmailSent ? (
              <>
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-headline font-bold">Reset Password</h2>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Enter the email associated with your Virasya account. We&apos;ll send you a link to reset your password.
                  </p>
                </div>

                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="you@example.com"
                        value={resetEmail || email}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          setEmail(e.target.value);
                        }}
                        required
                        className="pl-10 h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 rounded-full font-bold shadow-md gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Send Reset Link <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-headline font-bold text-foreground">Check Your Email</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We sent a password reset link to <br />
                    <strong className="text-foreground">{resetEmail || email}</strong>
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Didn&apos;t receive it? Check your spam folder or wait a few minutes before trying again.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode('signin');
                    setResetEmailSent(false);
                  }}
                  className="w-full h-11 rounded-full mt-2"
                >
                  Return to Sign In
                </Button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: NEW GOOGLE USER FIRST-TIME ROLE SELECTION */}
        {mode === 'google-role-select' && (
          <div className="space-y-6 text-center animate-in fade-in-50 duration-200">
            <div className="space-y-1">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-headline font-bold">One Final Step</h2>
              <p className="text-xs text-muted-foreground">
                How would you like to use Virasya?
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 text-left">
              <div
                onClick={() => handleFinalizeGoogleRole('artisan')}
                className="p-4 rounded-2xl border-2 border-border/80 hover:border-primary cursor-pointer transition-all hover:bg-primary/5 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">I am an Artisan</h4>
                    <p className="text-xs text-muted-foreground">I create handcrafted products and want to sell them.</p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => handleFinalizeGoogleRole('buyer')}
                className="p-4 rounded-2xl border-2 border-border/80 hover:border-primary cursor-pointer transition-all hover:bg-primary/5 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">I am a Buyer</h4>
                    <p className="text-xs text-muted-foreground">I want to discover and purchase verified authentic crafts.</p>
                  </div>
                </div>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Setting up your profile...
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: SIGN IN OR SIGN UP */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="space-y-6">
            
            {/* Top Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-secondary/40 rounded-full text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`py-2 rounded-full transition-all text-center ${
                  mode === 'signin'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`py-2 rounded-full transition-all text-center ${
                  mode === 'signup'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-2xl font-headline font-bold text-foreground">
                {mode === 'signin' ? 'Welcome Back' : 'Create an Account'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === 'signin' 
                  ? 'Sign in to manage your crafts or track your purchases.' 
                  : 'Join the community preserving and supporting heritage craft.'}
              </p>
            </div>

            {/* Google Authentication Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full h-11 rounded-full font-semibold border-border/80 hover:bg-secondary/40 gap-3 shadow-sm transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-white px-2 text-muted-foreground">Or with email</span>
              </div>
            </div>

            {/* SIGN UP: ROLE SELECTION */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Your Role</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('artisan')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                      role === 'artisan'
                        ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                        : 'border-border/60 hover:border-primary/40 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Store className={`h-4 w-4 ${role === 'artisan' ? 'text-primary' : 'text-muted-foreground'}`} />
                      {role === 'artisan' && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs">Artisan</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">Sell handcrafted art</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('buyer')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                      role === 'buyer'
                        ? 'border-accent bg-accent/5 text-foreground shadow-sm'
                        : 'border-border/60 hover:border-accent/40 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <User className={`h-4 w-4 ${role === 'buyer' ? 'text-accent' : 'text-muted-foreground'}`} />
                      {role === 'buyer' && <div className="h-2 w-2 rounded-full bg-accent" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs">Buyer</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">Discover & acquire</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={mode === 'signin' ? handleEmailSignIn : handleEmailSignUp} className="space-y-4">
              
              {/* Full Name for Sign Up */}
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="e.g. Meera Devi"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="pl-10 h-11 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-11 rounded-xl"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setMode('forgot-password');
                      }}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'signup' ? 6 : undefined}
                    className="pl-10 pr-10 h-11 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-full font-bold shadow-md mt-2 gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === 'signin' ? (
                  <>
                    Sign In <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Create {role === 'artisan' ? 'Artisan' : 'Buyer'} Account <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Bottom Toggle Note */}
            <div className="text-center pt-2">
              {mode === 'signin' ? (
                <p className="text-xs text-muted-foreground">
                  Don&apos;t have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign up now
                  </button>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign in instead
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground bg-secondary/30 py-2.5 px-4 rounded-xl">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Verified and protected by Firebase Authentication
        </div>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center paper-texture">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
