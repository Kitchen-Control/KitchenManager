import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext(null);

// Định nghĩa đường dẫn mặc định cho từng Role
const ROLE_PATHS = {
  1: '/admin',
  2: '/manager',
  3: '/store',
  4: '/kitchen',
  5: '/coordinator',
  6: '/shipper',
  7: '/warehouse', // Route cho Warehouse
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Khởi tạo isLoading là true để chặn render MainLayout cho đến khi check xong localStorage
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedUser = sessionStorage.getItem('kitchen_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          // Kiểm tra đơn giản xem user có hợp lệ không (có id và role)
          if (parsedUser && (parsedUser.user_id || parsedUser.userId) && parsedUser.role_id) {
            setUser(parsedUser);
          } else {
            // Nếu dữ liệu rác, xóa ngay
            sessionStorage.removeItem('kitchen_user');
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Failed to parse user from local storage:", error);
        sessionStorage.removeItem('kitchen_user');
        setUser(null);
      } finally {
        // Luôn tắt loading sau khi đã kiểm tra xong
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = (userData) => {
    if (userData && userData.user) {
      const fullUserData = {
        ...userData.user,
        token: userData.token,
      };
      setUser(fullUserData);
      sessionStorage.setItem('kitchen_user', JSON.stringify(fullUserData));

      // Không cần navigate ở đây nữa vì Login.jsx đã xử lý.
      // Việc navigate ở đây gây ra xung đột và double navigation.
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('kitchen_user');
    navigate('/login', { replace: true });
  };

  // --- Tự động Logout sau 5 phút không tương tác ---
  useEffect(() => {
    // Nếu chưa đăng nhập thì không cần chạy logic này
    if (!user) return;

    const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 phút (tính bằng mili giây)
    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log("Hết phiên làm việc do không tương tác. Đang đăng xuất...");
        logout();
      }, INACTIVITY_LIMIT);
    };

    // Các sự kiện được coi là "có tương tác"
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    // Lắng nghe sự kiện để reset timer
    events.forEach(event => document.addEventListener(event, resetTimer));

    // Khởi động timer lần đầu
    resetTimer();

    // Dọn dẹp khi component unmount hoặc user logout
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [user]); // Chạy lại khi trạng thái user thay đổi (đăng nhập/đăng xuất)

  const getRolePath = (roleId) => {
    // Ưu tiên roleId truyền vào, nếu không có thì lấy từ user hiện tại
    const id = roleId || user?.role_id;
    // Ép kiểu về Number để khớp với key trong ROLE_PATHS
    return ROLE_PATHS[Number(id)] || '/login';
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    getRolePath,
    isAuthenticated: !!user,
  };

  // Hiển thị màn hình chờ trong khi đang kiểm tra đăng nhập
  // Điều này ngăn chặn việc lộ nội dung trang Admin trước khi bị đá về Login
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Luôn render children để Login có thể navigate - MainLayout sẽ redirect nếu !user
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Component bảo vệ Route (Được gộp vào đây) ---
export const ProtectedRoute = ({ allowedRoles = [], children }) => {
  const { user, isLoading, getRolePath } = useAuth();
  const location = useLocation();

  // Hàm helper để đọc và xác thực user từ sessionStorage một cách an toàn
  const getSessionUser = () => {
    try {
      const storedUser = sessionStorage.getItem('kitchen_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Kiểm tra các trường quan trọng để đảm bảo user object hợp lệ
        if (parsedUser && (parsedUser.user_id || parsedUser.userId) && parsedUser.role_id != null) {
          return parsedUser;
        }
      }
      return null;
    } catch (error) {
      console.error("Lỗi khi đọc dữ liệu user từ sessionStorage:", error);
      // Xóa dữ liệu hỏng để tránh lỗi lặp lại
      sessionStorage.removeItem('kitchen_user');
      return null;
    }
  };

  // Trong lúc AuthProvider đang kiểm tra (lần đầu tải trang), không render gì cả
  if (isLoading) {
    return null;
  }

  // Giải quyết Race Condition: user từ state là nguồn chính, nhưng ngay sau khi login,
  // state chưa kịp cập nhật, nên ta dùng fallback là user từ sessionStorage.
  const effectiveUser = user || getSessionUser();

  if (!effectiveUser) {
    // Nếu không có thông tin user ở cả 2 nơi, chuyển về trang login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleId = effectiveUser.role_id != null ? Number(effectiveUser.role_id) : null;
  const isAllowed =
    allowedRoles.length === 0 ||
    (roleId != null && allowedRoles.includes(roleId));

  if (!isAllowed) {
    // Nếu user đã login nhưng không có quyền truy cập trang này,
    // đưa họ về trang chính của vai trò của họ.
    const fallbackPath = getRolePath(roleId);
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};
