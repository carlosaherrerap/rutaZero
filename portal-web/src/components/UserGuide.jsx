import React, { useEffect } from 'react';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const UserGuide = () => {
  const startTour = () => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendido',
      steps: [
        { 
          element: '#nav-principal', 
          popover: { 
            title: 'Principal', 
            description: 'Este es tu panel central. Aquí verás un resumen rápido de la sede seleccionada, estadísticas clave y accesos directos.', 
            side: "right", 
            align: 'start' 
          } 
        },
        { 
          element: '#nav-mapa', 
          popover: { 
            title: 'Mapa Operativo', 
            description: 'Visualiza en tiempo real la ubicación de tus clientes y el estado de las visitas programadas para el día.', 
            side: "right", 
            align: 'start' 
          } 
        },
        { 
          element: '#nav-clientes', 
          popover: { 
            title: 'Gestión de Clientes', 
            description: 'Administra tu cartera de clientes, revisa sus datos de contacto y su historial de pagos.', 
            side: "right", 
            align: 'start' 
          } 
        },
        { 
          element: '#nav-operadores', 
          popover: { 
            title: 'Operadores de Campo', 
            description: 'Controla y monitorea a tu equipo de trabajo. Desde aquí puedes ver su desempeño individual.', 
            side: "right", 
            align: 'start' 
          } 
        },
      ]
    });
    driverObj.drive();
  };

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setTimeout(() => {
        startTour();
        localStorage.setItem('hasSeenTour', 'true');
      }, 1500);
    }

    // Escuchar evento para inicio manual
    window.addEventListener('start-tour', startTour);
    return () => window.removeEventListener('start-tour', startTour);
  }, []);

  return null;
};

export default UserGuide;
