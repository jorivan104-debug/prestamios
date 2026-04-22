# Catálogo de permisos (v1)

Códigos **estables** definidos por el producto. Las organizaciones asignan subconjuntos a cada **rol personalizado** vía `role_permissions`.

| Código | Módulo | Descripción |
|--------|--------|-------------|
| `app.dashboard.view` | app | Ver panel principal |
| `clients.read` | clientes | Listar y ver clientes |
| `clients.create` | clientes | Crear clientes |
| `clients.update` | clientes | Editar clientes |
| `clients.delete` | clientes | Eliminar clientes |
| `loans.read` | prestamos | Listar y ver préstamos |
| `loans.create` | prestamos | Crear préstamos |
| `loans.update` | prestamos | Modificar préstamos |
| `payments.read` | pagos | Ver pagos |
| `payments.create` | pagos | Registrar pagos |
| `org.settings.manage` | configuracion | Editar datos de la organización |
| `users.invite` | equipo | Invitar / dar de alta miembros |
| `users.remove` | equipo | Quitar miembros |
| `users.assign_role` | equipo | Cambiar rol de un miembro |
| `roles.read` | equipo | Ver roles |
| `roles.create` | equipo | Crear roles |
| `roles.update` | equipo | Editar roles y permisos |
| `roles.delete` | equipo | Eliminar roles |

## Versionado

Al añadir permisos en un release:

1. Insertar fila en tabla `permissions` (migración SQL).
2. Documentar aquí la nueva fila.
3. Los roles existentes **no** ganan el permiso hasta que un administrador lo active en la matriz.

## Rol bootstrap «Propietario»

Al crear una organización se crea un rol de sistema **Propietario** (`is_system = true`) con **todos** los permisos del catálogo vigente en ese momento.
