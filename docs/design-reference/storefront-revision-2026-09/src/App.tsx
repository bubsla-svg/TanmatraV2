import { type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { StorefrontProvider } from '@/hooks/use-storefront';
import { StorefrontShell } from '@/components/storefront-shell';
import NotFound from '@/pages/not-found';
import { AboutPage, CartPage, DishPage, HomePage, MenuPage, PlansPage } from '@/pages/storefront-pages';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

function Router() {
  return <RoutedErrorBoundary><StorefrontShell><Switch>
    <Route path="/" component={HomePage} />
    <Route path="/menu" component={MenuPage} />
    <Route path="/dish/:slug" component={DishPage} />
    <Route path="/plans" component={PlansPage} />
    <Route path="/about" component={AboutPage} />
    <Route path="/cart" component={CartPage} />
    <Route component={NotFound} />
  </Switch></StorefrontShell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <StorefrontProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>
    </StorefrontProvider>
  );
}

export default App;
