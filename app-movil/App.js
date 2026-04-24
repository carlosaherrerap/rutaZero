import React, { useContext } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import RutaScreen from './src/screens/RutaScreen';
import RutaDetalleScreen from './src/screens/RutaDetalleScreen';
import DetalleClienteScreen from './src/screens/DetalleClienteScreen';
import FichaFormScreen from './src/screens/FichaFormScreen';
import AsistenciaScreen from './src/screens/AsistenciaScreen';

const Stack = createNativeStackNavigator();

function NavigationStack() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white' }}>Iniciando Ruta Zero...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right'
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Ruta" component={RutaScreen} />
            <Stack.Screen name="RutaDetalle" component={RutaDetalleScreen} />
            <Stack.Screen name="DetalleCliente" component={DetalleClienteScreen} />
            <Stack.Screen name="FichaForm" component={FichaFormScreen} />
            <Stack.Screen name="Asistencia" component={AsistenciaScreen} />
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
