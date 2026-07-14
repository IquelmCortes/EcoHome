#!/bin/bash

BASE_URL=http://localhost:3000

# 1) Signup admin
curl -X POST "$BASE_URL/auth/signup" -H "Content-Type: application/json" -d '{"name":"Admin Eco","email":"admin@ecohome.com","password":"123456","role":"admin"}'

echo

# 2) Signup cliente
curl -X POST "$BASE_URL/auth/signup" -H "Content-Type: application/json" -d '{"name":"Cliente Uno","email":"cliente@ecohome.com","password":"123456","role":"client"}'

echo

# 3) Login admin
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@ecohome.com","password":"123456"}' | python -c "import sys, json; print(json.load(sys.stdin)['token'])")

echo "TOKEN=$TOKEN"

echo

# 4) Crear producto con admin
curl -X POST "$BASE_URL/products" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"Vaso reciclado","price":12.5}'

echo

# 5) Listar productos sin token
curl -X GET "$BASE_URL/products"

echo

# 6) Intentar crear producto sin token
curl -X POST "$BASE_URL/products" -H "Content-Type: application/json" -d '{"name":"Intento no autorizado","price":5}'

echo

# 7) Actualizar producto
curl -X PATCH "$BASE_URL/products/1" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"price":15}'

echo

# 8) Eliminar producto
curl -X DELETE "$BASE_URL/products/1" -H "Authorization: Bearer $TOKEN"
