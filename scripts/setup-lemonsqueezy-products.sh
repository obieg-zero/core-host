#!/bin/bash

# Instrukcja tworzenia produktow w LemonSqueezy Dashboard
# Slug = nazwa produktu = nazwa repo = runtime ID pluginu
#
# Uzycie: ./scripts/setup-lemonsqueezy-products.sh

echo "============================================"
echo "  LemonSqueezy — dodawanie produktow"
echo "============================================"
echo ""
echo "Otworz: https://app.lemonsqueezy.com/products"
echo "Kliknij: + New Product"
echo ""
echo "============================================"
echo "  Produkt 1: plugin-wibor-calc"
echo "============================================"
echo "  Name:        plugin-wibor-calc"
echo "  Price:       PLN 4000"
echo "  Description: Kalkulator nadplat WIBOR dla kancelarii"
echo "  License Keys: WLACZ"
echo ""
echo "============================================"
echo "  Produkt 2: plugin-workflow-crm"
echo "============================================"
echo "  Name:        plugin-workflow-crm"
echo "  Price:       PLN 0 (darmowy)"
echo "  Description: Zarzadzanie sprawami, klientami i dokumentami"
echo "  License Keys: WLACZ"
echo ""
echo "============================================"
echo "  Po utworzeniu uruchom:"
echo "  LEMONSQUEEZY_API_KEY=xxx ./scripts/sync-lemonsqueezy-worker.sh"
echo "============================================"
