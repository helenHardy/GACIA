-- 1. Crear tabla de Marcas
create table if not exists public.brands (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null unique
);

-- 2. Crear tabla de Modelos
create table if not exists public.models (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    brand_id uuid references public.brands(id) on delete cascade,
    unique(name, brand_id)
);

-- 3. Modificar Tabla de Productos
alter table public.products 
add column if not exists brand_id uuid references public.brands(id),
add column if not exists model_id uuid references public.models(id),
add column if not exists description text,
add column if not exists image_url text;

-- 4. Opcional: Migrar datos de subcategoría a descripción si se desea conservar algo
-- update public.products set description = 'Subcategoría anterior: ' || subcategory where subcategory is not null;

-- 5. Eliminar columna subcategory
alter table public.products drop column if exists subcategory;

-- 6. Habilitar RLS para marcas y modelos
alter table public.brands enable row level security;
alter table public.models enable row level security;

create policy "Enable read access for all users" on public.brands for select using (true);
create policy "Enable insert access for authenticated users" on public.brands for insert with check (auth.role() = 'authenticated');
create policy "Enable update access for authenticated users" on public.brands for update using (auth.role() = 'authenticated');
create policy "Enable delete access for admin" on public.brands for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'Administrador')
);

create policy "Enable read access for all users" on public.models for select using (true);
create policy "Enable insert access for authenticated users" on public.models for insert with check (auth.role() = 'authenticated');
create policy "Enable update access for authenticated users" on public.models for update using (auth.role() = 'authenticated');
create policy "Enable delete access for admin" on public.models for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'Administrador')
);
