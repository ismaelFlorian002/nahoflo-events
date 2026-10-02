import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { EventService } from '../../../core/services/event.service';
import { ClienteService } from '../../../core/services/cliente.service';
import { PartnerService } from '../../../core/services/partner.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { Evento } from '../../../core/models/event.model';
import { EventFormComponent } from '../components/event-form/event-form.component';

interface EventoResumen {
  id: string;
  titulo: string;
  tipo: string;
  enlace: string;
  estaActivo: boolean;
  fecha: Date | null;
  diasRestantes: number | null;
  contactoNombre: string;
  fotoPrincipalUrl: string;
  ownerId: string | null;
  checklistTotal: number;
  checklistHechas: number;
}

interface Pendiente {
  evento: EventoResumen;
  motivo: string;
  icono: string;
  tono: 'amber' | 'rose' | 'sky';
}

interface Barra {
  etiqueta: string;
  valor: number;
  porcentaje: number;
}

const MS_DIA = 24 * 60 * 60 * 1000;

function aFecha(f: any): Date | null {
  if (!f) return null;
  if (typeof f.toDate === 'function') return f.toDate();
  if (f.seconds !== undefined) return new Date(f.seconds * 1000);
  if (f instanceof Date) return f;
  if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const [y, m, d] = f.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(f);
  return isNaN(d.getTime()) ? null : d;
}

function inicioDelDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function aBarras(conteos: Map<string, number>, limite: number): Barra[] {
  const ordenadas = [...conteos.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite);
  const max = Math.max(1, ...ordenadas.map(([, v]) => v));
  return ordenadas.map(([etiqueta, valor]) => ({ etiqueta, valor, porcentaje: Math.round((valor / max) * 100) }));
}

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, TooltipModule, DynamicDialogModule],
  providers: [DialogService],
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.scss',
})
export class PanelComponent implements OnInit {
  private eventService   = inject(EventService);
  private clienteService = inject(ClienteService);
  private partnerService = inject(PartnerService);
  private usuarioService = inject(UsuarioService);
  private dialogService  = inject(DialogService);
  private router         = inject(Router);

  readonly perfil    = toSignal(this.usuarioService.perfil$, { initialValue: null });
  readonly esAdmin   = computed(() => this.perfil()?.rol === 'admin');
  readonly esPartner = computed(() => this.perfil()?.rol === 'partner');

  cargando = signal(true);
  eventos = signal<EventoResumen[]>([]);
  totalClientes = signal(0);
  partnersActivos = signal(0);
  private nombresAgencias = signal(new Map<string, string>());

  readonly saludo = computed(() => {
    const h = new Date().getHours();
    const base = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const nombre = this.perfil()?.displayName?.trim().split(/\s+/)[0];
    return nombre ? `${base}, ${nombre}` : base;
  });

  readonly fechaHoy = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  readonly contexto = computed(() => {
    if (this.esAdmin()) return 'Resumen de toda la plataforma';
    const agencia = this.perfil()?.agenciaNombre;
    return agencia ? `Resumen de ${agencia}` : 'Resumen de tus eventos';
  });

  readonly total      = computed(() => this.eventos().length);
  readonly activos    = computed(() => this.eventos().filter((e) => e.estaActivo).length);
  readonly borradores = computed(() => this.total() - this.activos());
  readonly porcentajeActivos = computed(() =>
    this.total() ? Math.round((this.activos() / this.total()) * 100) : 0,
  );

  readonly deAgencias = computed(() => {
    const agencias = this.nombresAgencias();
    return this.eventos().filter((e) => e.ownerId && agencias.has(e.ownerId)).length;
  });
  readonly directos = computed(() => this.total() - this.deAgencias());

  private readonly futuros = computed(() =>
    this.eventos()
      .filter((e) => e.diasRestantes !== null && e.diasRestantes >= 0)
      .sort((a, b) => a.diasRestantes! - b.diasRestantes!),
  );

  readonly proximos30    = computed(() => this.futuros().filter((e) => e.diasRestantes! <= 30).length);
  readonly estaSemana    = computed(() => this.futuros().filter((e) => e.diasRestantes! <= 7).length);
  readonly proximos      = computed(() => this.futuros().slice(0, 6));

  readonly pendientes = computed<Pendiente[]>(() => {
    const lista: Pendiente[] = [];
    for (const ev of this.futuros()) {
      const dias = ev.diasRestantes!;
      if (!ev.estaActivo && dias <= 30) {
        lista.push({ evento: ev, motivo: `Sigue en borrador y faltan ${dias} días`, icono: 'pi pi-pencil', tono: 'amber' });
      } else if (ev.checklistTotal > 0 && dias <= 14 && ev.checklistHechas < ev.checklistTotal) {
        const avance = Math.round((ev.checklistHechas / ev.checklistTotal) * 100);
        lista.push({ evento: ev, motivo: `Checklist al ${avance}% a ${dias} días`, icono: 'pi pi-check-square', tono: 'rose' });
      } else if (!ev.contactoNombre && dias <= 60) {
        lista.push({ evento: ev, motivo: 'No tiene cliente asignado', icono: 'pi pi-user', tono: 'sky' });
      }
    }
    return lista.slice(0, 5);
  });

  readonly porMes = computed<Barra[]>(() => {
    const hoy = new Date();
    const meses = Array.from({ length: 6 }, (_, i) => new Date(hoy.getFullYear(), hoy.getMonth() + i, 1));
    const fmt = new Intl.DateTimeFormat('es-MX', { month: 'short' });
    const valores = meses.map(
      (m) =>
        this.eventos().filter(
          (e) => e.fecha && e.fecha.getFullYear() === m.getFullYear() && e.fecha.getMonth() === m.getMonth(),
        ).length,
    );
    const max = Math.max(1, ...valores);
    return meses.map((m, i) => ({
      etiqueta: fmt.format(m).replace('.', ''),
      valor: valores[i],
      porcentaje: Math.round((valores[i] / max) * 100),
    }));
  });

  readonly topAgencias = computed<Barra[]>(() => {
    const agencias = this.nombresAgencias();
    const conteos = new Map<string, number>();
    for (const ev of this.eventos()) {
      if (!ev.ownerId || !agencias.has(ev.ownerId)) continue;
      const nombre = agencias.get(ev.ownerId)!;
      conteos.set(nombre, (conteos.get(nombre) ?? 0) + 1);
    }
    return aBarras(conteos, 5);
  });

  readonly porTipo = computed<Barra[]>(() => {
    const conteos = new Map<string, number>();
    for (const ev of this.eventos()) {
      const tipo = ev.tipo || 'Otro';
      conteos.set(tipo, (conteos.get(tipo) ?? 0) + 1);
    }
    return aBarras(conteos, 5);
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const perfil = await this.usuarioService.esperarInicializacion();

      if (perfil?.rol === 'admin') {
        const [directos, agencias, clientesDirectos, clientesAgencias, partners] = await Promise.all([
          this.eventService.getEvents('directos'),
          this.eventService.getEvents('todos'),
          this.clienteService.getClientes('directos'),
          this.clienteService.getClientes('todos'),
          this.partnerService.getPartners(),
        ]);
        this.nombresAgencias.set(new Map(partners.map((p) => [p.uid, p.agenciaNombre || p.displayName])));
        this.partnersActivos.set(partners.filter((p) => p.estaActivo).length);
        this.totalClientes.set(clientesDirectos.length + clientesAgencias.length);
        this.eventos.set([...directos, ...agencias].map((e) => this.aResumen(e)));
      } else {
        const [eventos, clientes] = await Promise.all([
          this.eventService.getEvents(),
          this.clienteService.getClientes(),
        ]);
        this.totalClientes.set(clientes.length);
        this.eventos.set(eventos.map((e) => this.aResumen(e)));
      }
    } catch (error) {
      console.error('Error al cargar el dashboard:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  private aResumen(e: Evento): EventoResumen {
    const fecha = aFecha(e.fecha);
    const checklist = e.checklist ?? [];
    return {
      id: e.id ?? '',
      titulo: e.titulo || e.nombreEvento || 'Sin título',
      tipo: e.tipo || '',
      enlace: e.enlace,
      estaActivo: Boolean(e.estaActivo),
      fecha,
      diasRestantes: fecha ? Math.round((inicioDelDia(fecha) - inicioDelDia(new Date())) / MS_DIA) : null,
      contactoNombre: e.contactoNombre || '',
      fotoPrincipalUrl: e.fotoPrincipalUrl || '',
      ownerId: e.ownerId ?? null,
      checklistTotal: checklist.length,
      checklistHechas: checklist.filter((t) => t.completada).length,
    };
  }

  dia(fecha: Date | null): string {
    return fecha ? String(fecha.getDate()) : '--';
  }

  mes(fecha: Date | null): string {
    return fecha ? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(fecha).replace('.', '') : '';
  }

  etiquetaDias(dias: number | null): string {
    if (dias === null) return '';
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    return `En ${dias} días`;
  }

  agenciaDe(ev: EventoResumen): string {
    return (ev.ownerId && this.nombresAgencias().get(ev.ownerId)) || 'NahoFlo';
  }

  administrar(ev: EventoResumen): void {
    if (!ev.estaActivo || !ev.enlace) return;
    void this.router.navigate(['/e', ev.enlace, 'asistencias']);
  }

  nuevoEvento(): void {
    const ref = this.dialogService.open(EventFormComponent, {
      header: 'Crear Nuevo Evento',
      width: '1000px',
      breakpoints: { '1060px': '94vw' },
      closable: true,
      focusOnShow: false,
      styleClass: 'event-form-dialog',
    });
    ref?.onClose.subscribe(async (exito: boolean) => {
      if (exito) await this.cargar();
    });
  }
}
