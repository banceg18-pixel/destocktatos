-- Paiement par virement bancaire avant livraison : commande confirmée, en attente du virement.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EN_ATTENTE_VIREMENT';
