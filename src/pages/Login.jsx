import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { loginUser } from '../data/api';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ChefHat, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, getRolePath } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userData = await loginUser(username, password);

      if (userData && userData.user) {
        login(userData);
        
        // Truyền trực tiếp role_id vào getRolePath vì state user trong context chưa kịp cập nhật
        const roleId = userData.user.role_id;
        const path = getRolePath(roleId);
        
        console.log("Login Success. RoleID:", roleId, "Redirect Path:", path);

        if (path === '/login' || path === '/') {
          // Lấy tên role bị lỗi từ object user để hiển thị
          const failedRoleName = userData.user?.role?.role_name;
          toast.error(`Lỗi quyền: Không thể xác định vai trò từ tên '${failedRoleName || 'TRỐNG'}' mà API trả về.`);
          return;
        }

        toast.success('Đăng nhập thành công!');
        navigate(path, { replace: true });
      } else {
        toast.error('Tên đăng nhập hoặc mật khẩu không đúng.');
      }
    } catch (error) {
      toast.error(error.message || 'Đã có lỗi xảy ra khi đăng nhập.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <ChefHat className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Kitchen Control</h1>
          <p className="text-muted-foreground">Hệ thống quản lý bếp trung tâm</p>
        </div>

        {/* Login Form */}
        <Card className="shadow-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Đăng nhập</CardTitle>
            <CardDescription>
              Nhập thông tin đăng nhập để truy cập hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username">Tên đăng nhập</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
