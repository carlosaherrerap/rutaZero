import React, { useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function AsistenciaScreen({ navigation }) {
  const { api } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [jornadas, setJornadas] = useState([]); // Array de fechas con datos
  const [viewDate, setViewDate] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      fetchJornadas();
    }, [api])
  );

  const fetchJornadas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/workers/me/jornadas');
      setJornadas(res.data.data || []);
    } catch (e) {
      console.log('[Asistencia] Error fetching jornadas:', e);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // Construir grilla de días del mes
  const buildCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const getDayStatus = (day) => {
    if (!day) return null;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const jornada = jornadas.find(j => j.fecha && j.fecha.startsWith(dateStr));
    return jornada || null;
  };

  const today = new Date();
  const isToday = (day) =>
    day && viewDate.getFullYear() === today.getFullYear() &&
    viewDate.getMonth() === today.getMonth() &&
    day === today.getDate();

  const cells = buildCalendar();

  // Estadísticas del mes
  const mesJornadas = jornadas.filter(j => {
    const d = new Date(j.fecha);
    return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();
  });
  const diasValidados  = mesJornadas.filter(j => j.validado).length;
  const diasTrabajados = mesJornadas.filter(j => j.estado === 'JORNADA_FINALIZADA').length;

  const fmtHora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDuracion = (mins) => {
    if (!mins) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Asistencia</Text>
        <TouchableOpacity onPress={fetchJornadas}>
          <Ionicons name="refresh" size={22} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* STATS */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#10b981' }]}>{diasValidados}</Text>
            <Text style={styles.statLabel}>Días Validados</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#3b82f6' }]}>{diasTrabajados}</Text>
            <Text style={styles.statLabel}>Días Trabajados</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#f59e0b' }]}>{mesJornadas.length}</Text>
            <Text style={styles.statLabel}>Registros</Text>
          </View>
        </View>

        {/* NAVEGACIÓN DE MES */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.monthBtn}>
            <Ionicons name="chevron-back" size={22} color="#3b82f6" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MESES[viewDate.getMonth()]} {viewDate.getFullYear()}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.monthBtn}>
            <Ionicons name="chevron-forward" size={22} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {/* ENCABEZADOS DÍAS SEMANA */}
        <View style={styles.weekHeader}>
          {DIAS_SEMANA.map(d => (
            <Text key={d} style={styles.weekDay}>{d}</Text>
          ))}
        </View>

        {/* GRILLA CALENDARIO */}
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              const jornada = getDayStatus(day);
              const validated = jornada?.validado;
              const worked = jornada?.estado === 'JORNADA_FINALIZADA';
              const inProgress = jornada?.estado === 'JORNADA_INICIADA';
              const todayDay = isToday(day);

              return (
                <View key={idx} style={[
                  styles.cell,
                  validated && styles.cellValidated,
                  !validated && worked && styles.cellWorked,
                  inProgress && styles.cellInProgress,
                  todayDay && styles.cellToday,
                ]}>
                  {day ? (
                    <>
                      <Text style={[
                        styles.cellNum,
                        validated && { color: '#fff' },
                        todayDay && !validated && { color: '#3b82f6', fontWeight: '900' }
                      ]}>
                        {day}
                      </Text>
                      {validated && <Ionicons name="checkmark" size={10} color="#fff" />}
                      {!validated && worked && <View style={styles.workedDot} />}
                      {inProgress && <View style={[styles.workedDot, { backgroundColor: '#f59e0b' }]} />}
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* LEYENDA */}
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#10b981' }]} /><Text style={styles.legendText}>Validado por Admin</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} /><Text style={styles.legendText}>Trabajado</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} /><Text style={styles.legendText}>En curso</Text></View>
        </View>

        {/* HISTORIAL JORNADAS DEL MES */}
        <View style={styles.histSection}>
          <Text style={styles.histTitle}>Historial del mes</Text>
          {mesJornadas.length === 0 ? (
            <Text style={styles.emptyText}>No hay jornadas registradas este mes.</Text>
          ) : mesJornadas.map((j, idx) => (
            <View key={idx} style={styles.jornadaCard}>
              <View style={styles.jornadaHeader}>
                <Text style={styles.jornadaFecha}>
                  {new Date(j.fecha).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' })}
                </Text>
                {j.validado && (
                  <View style={styles.validBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                    <Text style={styles.validText}>Validado</Text>
                  </View>
                )}
              </View>
              <View style={styles.jornadaRow}>
                <View style={styles.jornadaItem}><Ionicons name="log-in-outline" size={14} color="#10b981" /><Text style={styles.jornadaVal}>{fmtHora(j.hora_inicio_sesion)}</Text></View>
                <View style={styles.jornadaItem}><Ionicons name="restaurant-outline" size={14} color="#f59e0b" /><Text style={styles.jornadaVal}>{j.duracion_refrigerio_min ? fmtDuracion(j.duracion_refrigerio_min) : '—'}</Text></View>
                <View style={styles.jornadaItem}><Ionicons name="log-out-outline" size={14} color="#ef4444" /><Text style={styles.jornadaVal}>{fmtHora(j.hora_fin_jornada)}</Text></View>
                <View style={styles.jornadaItem}><Ionicons name="time-outline" size={14} color="#3b82f6" /><Text style={styles.jornadaVal}>{j.horas_trabajadas ? fmtDuracion(Math.round(j.horas_trabajadas * 60)) : '—'}</Text></View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* BARRA INFERIOR */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="people" size={24} color="#94a3b8" />
          <Text style={styles.tabLabel}>CLIENTES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Ruta')}>
          <Ionicons name="map" size={24} color="#94a3b8" />
          <Text style={styles.tabLabel}>MIS RUTAS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="calendar" size={24} color="#3b82f6" />
          <Text style={[styles.tabLabel, { color: '#3b82f6' }]}>ASISTENCIA</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  statsRow: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 8 },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#e2e8f0' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff' },
  monthBtn: { padding: 6 },
  monthTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  weekHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f8fafc' },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  cell: { width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  cellNum: { fontSize: 14, fontWeight: '600', color: '#475569' },
  cellValidated: { backgroundColor: '#10b981', borderRadius: 999, margin: 2 },
  cellWorked: { backgroundColor: '#dbeafe', borderRadius: 999, margin: 2 },
  cellInProgress: { backgroundColor: '#fef3c7', borderRadius: 999, margin: 2 },
  cellToday: { borderWidth: 2, borderColor: '#3b82f6', borderRadius: 999, margin: 2 },
  workedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#3b82f6', marginTop: 1 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, padding: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#64748b' },
  histSection: { padding: 16 },
  histTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  emptyText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 },
  jornadaCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  jornadaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  jornadaFecha: { fontSize: 13, fontWeight: '700', color: '#1e293b', textTransform: 'capitalize' },
  validBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  validText: { fontSize: 10, fontWeight: '800', color: '#10b981' },
  jornadaRow: { flexDirection: 'row', justifyContent: 'space-around' },
  jornadaItem: { alignItems: 'center', gap: 3 },
  jornadaVal: { fontSize: 12, fontWeight: '600', color: '#334155' },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 75, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 20 },
  tabItem: { alignItems: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 4 },
});
