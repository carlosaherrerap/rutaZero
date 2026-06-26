import React, { useContext } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import RutaScreen from './src/screens/RutaScreen';
import RutaDetalleScreen from './src/screens/RutaDetalleScreen';
import DetalleClienteScreen from './src/screens/DetalleClienteScreen';
import FichaFormScreen from './src/screens/FichaFormScreen';
import AsistenciaScreen from './src/screens/AsistenciaScreen';
import PermisosScreen from './src/screens/PermisosScreen';
import AmonestacionesScreen from './src/screens/AmonestacionesScreen';
import DebugStorageScreen from './src/screens/DebugStorageScreen';
import EvaluarCreditoScreen from './src/screens/EvaluarCreditoScreen';
import { TrackingService } from './src/services/TrackingService';
import { SecurityService } from './src/services/SecurityService';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- STACKS ANIDADOS PARA QUE LA BARRA PERSISTA ---

function ClientesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="DetalleCliente" component={DetalleClienteScreen} />
      <Stack.Screen name="FichaForm" component={FichaFormScreen} />
      <Stack.Screen name="EvaluarCredito" component={EvaluarCreditoScreen} />
    </Stack.Navigator>
  );
}

function RutasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RutaMain" component={RutaScreen} />
      <Stack.Screen name="RutaDetalle" component={RutaDetalleScreen} />
      <Stack.Screen name="DetalleCliente" component={DetalleClienteScreen} />
      <Stack.Screen name="FichaForm" component={FichaFormScreen} />
      <Stack.Screen name="EvaluarCredito" component={EvaluarCreditoScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        // Cada sección tiene su color propio ESTÁTICO SIEMPRE visible
        let sectionColor = '#4A90D9';
        let iconName = 'account-group';
        
        if (route.name === 'ClientesTab') { 
          sectionColor = '#4A90D9'; iconName = 'account-group'; 
        } else if (route.name === 'RutasTab') { 
          sectionColor = '#E0A526'; iconName = 'map-marker-path'; 
        } else if (route.name === 'AsistenciaTab') { 
          sectionColor = '#2EAA7B'; iconName = 'calendar-check'; 
        } else if (route.name === 'PermisosTab') { 
          sectionColor = '#9B7FD4'; iconName = 'file-document-outline'; 
        } else if (route.name === 'AmonestacionesTab') { 
          sectionColor = '#E06B7A'; iconName = 'alert-circle-outline'; 
        }
        
        return {
          headerShown: false,
          tabBarActiveTintColor: sectionColor,
          tabBarInactiveTintColor: sectionColor,  // Siempre su color, nunca gris
          tabBarStyle: { 
            height: 72 + insets.bottom, 
            paddingBottom: 12 + insets.bottom, 
            paddingTop: 8,
            backgroundColor: '#F8FAFC',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            elevation: 0,
            shadowOpacity: 0
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
          tabBarIcon: () => {
            return (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <MaterialCommunityIcons name={iconName} size={28} color={sectionColor} />
              </View>
            );
          },
        };
      }}
    >
      <Tab.Screen name="ClientesTab" component={ClientesStack} options={{ title: 'CLIENTES' }} />
      <Tab.Screen name="RutasTab" component={RutasStack} options={{ title: 'MIS RUTAS' }} />
      <Tab.Screen name="AsistenciaTab" component={AsistenciaScreen} options={{ title: 'ASISTENCIA' }} />
      <Tab.Screen name="PermisosTab" component={PermisosScreen} options={{ title: 'PERMISOS' }} />
      <Tab.Screen name="AmonestacionesTab" component={AmonestacionesScreen} options={{ title: 'FALTAS' }} />
    </Tab.Navigator>
  );
}

function NavigationStack() {
  const { user, loading } = useContext(AuthContext);

  React.useEffect(() => {
    // 100% Strict Security: Check for Root/Jailbreak on mount
    const isSecure = SecurityService.runStrictSecurityChecks();
    if (!isSecure) return; // Halt if compromised

    if (user) {
      TrackingService.startTracking();
    } else {
      TrackingService.stopTracking();
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F0', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#1A1A1A' }}>Iniciando Routing...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="DebugStorage" component={DebugStorageScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
