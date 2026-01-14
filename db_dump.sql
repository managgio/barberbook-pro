-- MySQL dump 10.13  Distrib 9.4.0, for macos15.4 (arm64)
--
-- Host: 127.0.0.1    Database: leblond
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_OfferCategories`
--

DROP TABLE IF EXISTS `_OfferCategories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_OfferCategories` (
  `A` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `B` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  UNIQUE KEY `_OfferCategories_AB_unique` (`A`,`B`),
  KEY `_OfferCategories_B_index` (`B`),
  CONSTRAINT `_OfferCategories_A_fkey` FOREIGN KEY (`A`) REFERENCES `Offer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_OfferCategories_B_fkey` FOREIGN KEY (`B`) REFERENCES `ServiceCategory` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_OfferCategories`
--

LOCK TABLES `_OfferCategories` WRITE;
/*!40000 ALTER TABLE `_OfferCategories` DISABLE KEYS */;
/*!40000 ALTER TABLE `_OfferCategories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('38cb6abe-05cb-4ffb-b79b-4232e9d8db4d','2f41c48a94273974f4c0fbc42fa62d883eade0afea3b7eeb60715e3901adf807','2025-12-29 14:10:19.125','20251229141019_add_reminder_sent',NULL,NULL,'2025-12-29 14:10:19.122',1),('3b78001e-71e9-4cb1-b2c1-a295a8a15d95','adc49a7e1d1442cb0c7ff95c8470bfce53c44c12d9d995f2020fce6a4b9c07f0','2026-01-05 14:26:16.407','20260105142616_add_site_settings',NULL,NULL,'2026-01-05 14:26:16.405',1),('4532bab9-d262-4732-a66e-6d016d4f7dc1','d70e3fb99c0ce1638314c29a0dc514e4303606a47503abed3872275bdbcac845','2025-12-29 18:20:43.527','20251229182043_add_barber_photo_file_id',NULL,NULL,'2025-12-29 18:20:43.523',1),('76b5e669-3e86-4dac-b3d7-4fde2b1d8293','f29f3b438d8c0e8af7e6f1bf6621bef5aaadbf26b167ce1f0320697294d77a29','2026-01-13 15:14:41.718','20260113151441_remove_confirmed_status',NULL,NULL,'2026-01-13 15:14:41.711',1),('9e29ad99-23d7-42fd-b744-b41d7e449d4a','56bb19335d7098399e1e96d501aeab961b5cec21b361fca2329e3b7d5c93d6ec','2025-12-29 13:11:37.718','20251229131137_init',NULL,NULL,'2025-12-29 13:11:37.660',1),('a0d447dc-5d92-47d0-af9e-ddfc9bba54ba','8aec726d2b9e9a77e8003dee5d1f21f34c4c102c40ec24196aadd2d8b83e8659','2026-01-07 01:54:48.595','20260107015448_alert_schedule',NULL,NULL,'2026-01-07 01:54:48.525',1),('a1cf75f8-1a37-4c78-8bad-aabc0e77f491','074230b2b0ade3ccdf38bd79f78fb174e69057fff9b1e9459ba94c8a1076f71c','2026-01-07 02:19:42.073','20260109120000_add_appointment_price',NULL,NULL,'2026-01-07 02:19:42.067',1),('abffa380-0f4a-40ee-8396-1f25ae083f2a','864e1a2bd7ac9057502f7d221a9707918e4eaddc1a533210334ad15052c1f059','2026-01-07 00:56:44.313','20260107005644_service_categories',NULL,NULL,'2026-01-07 00:56:44.290',1),('ad010569-3f0c-43ec-bc68-a7dbed6b63ae','a5848456bb4aa9e51cf345176614878b58a41a2d8fc2f83c0178a77a8084e419','2026-01-06 19:50:53.660','20260106195053_add_imagekit_modification',NULL,NULL,'2026-01-06 19:50:53.653',1),('cfb8a949-a859-45b2-9d46-c1eef2d8192b','1fbefa0efe48842885e411001aca8fa6b74f398c74d5549ace8764269cf05384','2026-01-07 01:32:21.914','20260107013221_offers',NULL,NULL,'2026-01-07 01:32:21.891',1),('d21396ee-8997-4ed6-95da-212dc8d0a182','bd3f6c05df0fcbc8db9809a36994d656ad6b4ca2bfba4455e2d9dbc6aac46081','2026-01-11 19:27:15.196','20260110120000_add_ai_assistant',NULL,NULL,'2026-01-11 19:27:15.180',1),('dd1c7117-1c42-4d2a-820f-164eb4bea355','d4fad40c8762c4ffed657e0da3cf11b80e0c7d03e777f9303bb2fd73ba81c90e','2026-01-13 14:41:33.139','20260113144133_appointment_statuses',NULL,NULL,'2026-01-13 14:41:33.130',1),('f7336723-847f-40b0-9963-9304a752d432','9238b6fc3aef1847b70a88eb498377716a3eea0dc954618f7199947ee4c553c7','2026-01-11 19:39:08.455','20260111192715_add_ai_assistant','',NULL,'2026-01-11 19:39:08.455',0),('f9c5178e-e45b-4e7b-9ba1-549cfa40fde6','a190402c5f1a5b8894e9b15b4ec25445b380a53438d13d8322f923e1292d20ab','2026-01-12 14:26:09.365','20260112120000_add_user_barber_preference',NULL,NULL,'2026-01-12 14:26:09.361',1),('fa1631bb-7cc3-4c37-8685-cb059c3c205d','db47d30cf36d001f400528d3ae301910d5a7c17b5cdd15c090a90187cfaf2ad5','2026-01-06 19:50:53.484','20260106195000_widen_barber_photo',NULL,NULL,'2026-01-06 19:50:53.476',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `_ServiceOffers`
--

DROP TABLE IF EXISTS `_ServiceOffers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_ServiceOffers` (
  `A` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `B` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  UNIQUE KEY `_ServiceOffers_AB_unique` (`A`,`B`),
  KEY `_ServiceOffers_B_index` (`B`),
  CONSTRAINT `_ServiceOffers_A_fkey` FOREIGN KEY (`A`) REFERENCES `Offer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_ServiceOffers_B_fkey` FOREIGN KEY (`B`) REFERENCES `Service` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_ServiceOffers`
--

LOCK TABLES `_ServiceOffers` WRITE;
/*!40000 ALTER TABLE `_ServiceOffers` DISABLE KEYS */;
/*!40000 ALTER TABLE `_ServiceOffers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `AdminRole`
--

DROP TABLE IF EXISTS `AdminRole`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AdminRole` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissions` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AdminRole`
--

LOCK TABLES `AdminRole` WRITE;
/*!40000 ALTER TABLE `AdminRole` DISABLE KEYS */;
INSERT INTO `AdminRole` VALUES ('role-frontdesk','Recepción','Solo operaciones básicas de agenda.','[\"dashboard\", \"calendar\", \"search\", \"clients\"]','2026-01-07 14:01:15.404','2026-01-07 14:01:15.404'),('role-manager','Manager','Control del día a día del salón.','[\"dashboard\", \"calendar\", \"search\", \"clients\", \"services\", \"barbers\"]','2026-01-07 14:01:15.402','2026-01-07 14:01:15.402');
/*!40000 ALTER TABLE `AdminRole` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_business_facts`
--

DROP TABLE IF EXISTS `ai_business_facts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_business_facts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ai_business_facts_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_business_facts`
--

LOCK TABLES `ai_business_facts` WRITE;
/*!40000 ALTER TABLE `ai_business_facts` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_business_facts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_chat_messages`
--

DROP TABLE IF EXISTS `ai_chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_chat_messages` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('user','assistant','tool') COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tool_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tool_payload` json DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ai_chat_messages_session_id_created_at_idx` (`session_id`,`created_at`),
  CONSTRAINT `ai_chat_messages_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `ai_chat_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_chat_messages`
--

LOCK TABLES `ai_chat_messages` WRITE;
/*!40000 ALTER TABLE `ai_chat_messages` DISABLE KEYS */;
INSERT INTO `ai_chat_messages` VALUES ('0c4fff04-276c-4cfd-9b34-abafa645accd','20f46af4-48c7-4b95-bffa-6c7dd0c78639','user','Alejandro ruiz',NULL,NULL,'2026-01-14 08:21:05.374'),('20a6f46c-ebcc-4c2d-876e-eefef30e23f8','20f46af4-48c7-4b95-bffa-6c7dd0c78639','assistant','Ese horario no está disponible para ese barbero y servicio.',NULL,NULL,'2026-01-14 08:21:09.024'),('2eee0918-dd33-4959-ae56-d878160ec51c','20f46af4-48c7-4b95-bffa-6c7dd0c78639','tool','{\"status\":\"unavailable\",\"reason\":\"slot_unavailable\",\"barberId\":\"barber-2\",\"serviceId\":\"service-1\"}','create_appointment','{\"reason\": \"slot_unavailable\", \"status\": \"unavailable\", \"barberId\": \"barber-2\", \"serviceId\": \"service-1\"}','2026-01-14 08:21:09.019'),('3536b65d-9d90-4ff1-b674-e539b8d14fa7','20f46af4-48c7-4b95-bffa-6c7dd0c78639','tool','{\"status\":\"created\",\"appointmentId\":\"cmkdr69ce0005j6b9v44nu354\",\"startDateTime\":\"2026-01-14T09:00:00.000Z\",\"barberId\":\"barber-2\",\"barberName\":\"Alejandro Ruiz\",\"serviceId\":\"service-1\",\"serviceName\":\"Corte clásico\",\"userType\":\"registered\",\"clientName\":\"Carlos López Monreal\"}','create_appointment','{\"status\": \"created\", \"barberId\": \"barber-2\", \"userType\": \"registered\", \"serviceId\": \"service-1\", \"barberName\": \"Alejandro Ruiz\", \"clientName\": \"Carlos López Monreal\", \"serviceName\": \"Corte clásico\", \"appointmentId\": \"cmkdr69ce0005j6b9v44nu354\", \"startDateTime\": \"2026-01-14T09:00:00.000Z\"}','2026-01-14 08:22:40.828'),('3fd69952-d94e-4014-a88b-efce56e466af','20f46af4-48c7-4b95-bffa-6c7dd0c78639','user','Crea una cita para Carlos Lopez  para mañana a las 10.00 con servicio corte clásico  y con barbero Alejandro Ruiz',NULL,NULL,'2026-01-14 08:20:23.639'),('4be04d33-f8f2-4d6b-a75e-fa8c3751bf22','20f46af4-48c7-4b95-bffa-6c7dd0c78639','tool','{\"status\":\"needs_info\",\"missing\":[\"barberId\"]}','create_appointment','{\"status\": \"needs_info\", \"missing\": [\"barberId\"]}','2026-01-14 08:22:28.543'),('56e9b8a8-2705-4933-a765-2556dc4471ee','20f46af4-48c7-4b95-bffa-6c7dd0c78639','assistant','Para crear la cita necesito: barbero.',NULL,NULL,'2026-01-14 08:22:28.549'),('6471d8b8-cc69-4e82-be4b-9647a819ea9c','20f46af4-48c7-4b95-bffa-6c7dd0c78639','user','alejandro ruiz',NULL,NULL,'2026-01-14 08:22:36.583'),('6cfb7026-8ffd-490a-bfeb-0a20346fc96b','20f46af4-48c7-4b95-bffa-6c7dd0c78639','tool','{\"status\":\"needs_info\",\"missing\":[\"userEmail\"],\"reason\":\"user_ambiguous\",\"matchCount\":2,\"options\":{\"users\":[{\"id\":\"cmka01qe20003szigs1l8unuc\",\"name\":\"Carlos López Monreal\",\"email\":\"c.lopemonre@gmail.com\"},{\"id\":\"cmkdr25ff0001j6b979qmrzbr\",\"name\":\"Carlos López\",\"email\":\"carloslopezmonreal@gmail.com\"}]}}','create_appointment','{\"reason\": \"user_ambiguous\", \"status\": \"needs_info\", \"missing\": [\"userEmail\"], \"options\": {\"users\": [{\"id\": \"cmka01qe20003szigs1l8unuc\", \"name\": \"Carlos López Monreal\", \"email\": \"c.lopemonre@gmail.com\"}, {\"id\": \"cmkdr25ff0001j6b979qmrzbr\", \"name\": \"Carlos López\", \"email\": \"carloslopezmonreal@gmail.com\"}]}, \"matchCount\": 2}','2026-01-14 08:20:26.081'),('716cda02-19a5-40a6-b134-126833b4fd42','20f46af4-48c7-4b95-bffa-6c7dd0c78639','assistant','Para crear la cita necesito: barbero.',NULL,NULL,'2026-01-14 08:20:59.767'),('7b0d10d7-3b04-457a-93f7-bea917dcbcda','20f46af4-48c7-4b95-bffa-6c7dd0c78639','user','entonces que la cita sea para hoy',NULL,NULL,'2026-01-14 08:22:24.885'),('924b1f53-8e18-43ec-899f-feefa5641a86','20f46af4-48c7-4b95-bffa-6c7dd0c78639','user','c.lopemonre@gmail.com',NULL,NULL,'2026-01-14 08:20:50.148'),('ae7fa0fb-ed08-449f-8e8e-19a296f3f986','20f46af4-48c7-4b95-bffa-6c7dd0c78639','tool','{\"status\":\"needs_info\",\"missing\":[\"barberId\"]}','create_appointment','{\"status\": \"needs_info\", \"missing\": [\"barberId\"]}','2026-01-14 08:20:59.761'),('b794beaa-69e4-4876-bdae-98d44bb73a62','20f46af4-48c7-4b95-bffa-6c7dd0c78639','assistant','Hay varios clientes con ese nombre. Indica el cliente por nombre completo o email. Opciones: Carlos López Monreal (c.lopemonre@gmail.com), Carlos López (carloslopezmonreal@gmail.com).',NULL,NULL,'2026-01-14 08:20:26.087'),('bbbe5a12-e555-45fc-a74d-e26a2b60e5b6','20f46af4-48c7-4b95-bffa-6c7dd0c78639','assistant','Cita creada. Cliente: Carlos López Monreal. Fecha: 14 de enero de 2026. Hora: 10:00. Servicio: Corte clásico. Barbero: Alejandro Ruiz.',NULL,NULL,'2026-01-14 08:22:40.836');
/*!40000 ALTER TABLE `ai_chat_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_chat_sessions`
--

DROP TABLE IF EXISTS `ai_chat_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_chat_sessions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `last_message_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ai_chat_sessions_admin_user_id_idx` (`admin_user_id`),
  KEY `ai_chat_sessions_last_message_at_idx` (`last_message_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_chat_sessions`
--

LOCK TABLES `ai_chat_sessions` WRITE;
/*!40000 ALTER TABLE `ai_chat_sessions` DISABLE KEYS */;
INSERT INTO `ai_chat_sessions` VALUES ('105ea111-e613-4b31-b1cd-8390d358f013','user-2',NULL,'','2026-01-11 20:09:29.500','2026-01-14 08:19:42.012','2026-01-11 20:09:32.592'),('1259e78c-eaf9-4ae0-9a95-10d59a4d721e','user-2',NULL,'','2026-01-11 19:57:52.771','2026-01-14 08:19:42.012','2026-01-11 19:57:56.415'),('20f46af4-48c7-4b95-bffa-6c7dd0c78639','user-2',NULL,'Se solicitó una cita para Carlos López Monreal mañana a las 10:00 con el barbero Alejandro Ruiz para un corte clásico. Se pidió aclarar el nombre completo del cliente debido a la existencia de varios clientes con el mismo nombre. Se confirmó el correo electrónico c.lopemonre@gmail.com. Sin embargo, el horario solicitado no estaba disponible. El usuario optó por cambiar la cita para hoy, pero se reiteró la necesidad de especificar el barbero.','2026-01-11 20:38:02.897','2026-01-14 08:22:40.838','2026-01-14 08:22:40.837'),('2fea2d4d-b612-4dfb-84e8-0c2c2c04fcb7','user-2',NULL,'','2026-01-11 19:46:56.412','2026-01-14 08:19:42.012','2026-01-11 19:46:56.417'),('3d4234a8-44b1-4fcb-87dd-091966b21aed','user-2',NULL,'','2026-01-11 20:23:11.969','2026-01-14 08:19:42.012','2026-01-11 20:23:14.791'),('43f2cae9-0c1c-4bd8-ad99-19e6e8d241fa','user-2',NULL,'','2026-01-11 19:48:47.015','2026-01-14 08:19:42.012','2026-01-11 19:49:58.712'),('452a3c22-51c8-45f8-9882-7bbabcbf28e5','user-2',NULL,'','2026-01-11 20:10:10.832','2026-01-14 08:19:42.012','2026-01-11 20:10:15.724'),('4693ab3b-3323-4074-b7dd-e33dde42692d','user-2',NULL,'','2026-01-11 20:20:24.603','2026-01-14 08:19:42.012','2026-01-11 20:20:27.275'),('4df01e64-359a-4ebb-95da-47bb04f33967','user-2',NULL,'','2026-01-11 19:47:18.940','2026-01-14 08:19:42.012','2026-01-11 19:47:18.942'),('500a7808-2142-4019-b45a-28fadb011e1b','user-2',NULL,'','2026-01-11 20:09:49.751','2026-01-14 08:19:42.012','2026-01-11 20:09:52.931'),('7342f63c-43e2-40fd-9a05-ffca2c175f6b','user-2',NULL,'','2026-01-11 20:09:23.902','2026-01-14 08:19:42.012','2026-01-11 20:09:27.343'),('879865f5-3223-4c50-92dc-bd494cf5aed1','user-2',NULL,'','2026-01-11 20:24:57.281','2026-01-14 08:19:42.012','2026-01-11 20:25:20.174'),('a7e82478-fd93-4215-8ed8-865115054f19','user-2',NULL,'','2026-01-11 20:23:57.011','2026-01-14 08:19:42.012','2026-01-11 20:24:00.533'),('b4d536fb-0e4b-406d-822e-7f22d7d46cff','user-2',NULL,'','2026-01-11 19:46:45.486','2026-01-14 08:19:42.012','2026-01-11 19:46:45.490'),('bad7780f-bb54-4b6f-aa5f-50e7c6c1b296','user-2',NULL,'','2026-01-11 20:36:47.949','2026-01-14 08:19:42.012','2026-01-11 20:36:51.295'),('d579590e-8bf6-4ad1-abf6-f9b922533f4b','user-2',NULL,'','2026-01-11 19:51:04.276','2026-01-14 08:19:42.012','2026-01-11 19:56:15.606'),('dc75cc2d-9647-4eea-947d-5eb0b5dcb175','user-2',NULL,'','2026-01-11 20:09:29.485','2026-01-14 08:19:42.012','2026-01-11 20:09:33.791'),('dd4e1c55-500d-4c19-a536-d4b3f5e72118','user-2',NULL,'','2026-01-11 19:40:58.378','2026-01-14 08:19:42.012','2026-01-11 19:40:58.383'),('e8dd1dd8-ea8b-49f9-bc0e-49ef92cf3d6c','user-2',NULL,'','2026-01-11 20:20:59.854','2026-01-14 08:19:42.012','2026-01-11 20:21:03.904'),('eff3d090-58d3-4352-8561-193d2d6576a9','user-2',NULL,'','2026-01-11 20:34:40.073','2026-01-14 08:19:42.012','2026-01-11 20:35:24.435'),('f5dd1b6c-8fa9-4402-a7e4-6d2c06555ece','user-2',NULL,'','2026-01-11 19:41:34.807','2026-01-14 08:19:42.012','2026-01-11 19:41:34.812');
/*!40000 ALTER TABLE `ai_chat_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Alert`
--

DROP TABLE IF EXISTS `Alert`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Alert` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `type` enum('info','warning','success') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `endDate` datetime(3) DEFAULT NULL,
  `startDate` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Alert`
--

LOCK TABLES `Alert` WRITE;
/*!40000 ALTER TABLE `Alert` DISABLE KEYS */;
INSERT INTO `Alert` VALUES ('alert-1','¡Felices Fiestas!','Durante las fiestas navideñas tendremos horario especial. Consulta disponibilidad.',1,'info','2026-01-07 14:01:15.421','2026-01-07 14:01:15.421',NULL,NULL),('alert-2','Nuevo servicio','Ya disponible nuestro tratamiento capilar premium.',0,'success','2026-01-07 14:01:15.422','2026-01-07 14:01:15.422',NULL,NULL);
/*!40000 ALTER TABLE `Alert` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Appointment`
--

DROP TABLE IF EXISTS `Appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Appointment` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `barberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `serviceId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `startDateTime` datetime(3) NOT NULL,
  `status` enum('scheduled','completed','cancelled','no_show') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'scheduled',
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guestName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guestContact` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `reminderSent` tinyint(1) NOT NULL DEFAULT '0',
  `price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Appointment_userId_fkey` (`userId`),
  KEY `Appointment_barberId_fkey` (`barberId`),
  KEY `Appointment_serviceId_fkey` (`serviceId`),
  CONSTRAINT `Appointment_barberId_fkey` FOREIGN KEY (`barberId`) REFERENCES `Barber` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Appointment_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Appointment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Appointment`
--

LOCK TABLES `Appointment` WRITE;
/*!40000 ALTER TABLE `Appointment` DISABLE KEYS */;
INSERT INTO `Appointment` VALUES ('apt-1','user-1','barber-1','service-2','2026-01-08 09:00:00.000','cancelled',NULL,NULL,NULL,'2026-01-07 14:01:15.425','2026-01-13 15:29:30.730',1,22.00),('apt-2','user-1','barber-2','service-5','2026-01-06 10:30:00.000','completed',NULL,NULL,NULL,'2026-01-07 14:01:15.426','2026-01-07 14:01:15.426',0,28.00),('apt-3','user-3','barber-1','service-1','2026-01-07 14:00:00.000','completed',NULL,NULL,NULL,'2026-01-07 14:01:15.428','2026-01-13 15:09:32.096',0,18.00),('apt-4','user-3','barber-3','service-3','2026-01-09 11:00:00.000','cancelled',NULL,NULL,NULL,'2026-01-07 14:01:15.429','2026-01-13 15:29:43.522',1,12.00),('cmka02dhz0005szigsoct84i7','cmka01qe20003szigs1l8unuc','barber-2','service-4','2026-01-12 08:00:00.000','completed',NULL,NULL,NULL,'2026-01-11 17:20:29.400','2026-01-13 15:09:32.096',0,20.00),('cmka04gv80009szigbvdraj2l','cmka01qe20003szigs1l8unuc','barber-3','service-5','2026-01-13 08:00:00.000','completed',NULL,NULL,NULL,'2026-01-11 17:22:07.076','2026-01-13 15:09:32.096',0,28.00),('cmkabzjs50001my4573mhpd3t',NULL,'barber-2','service-1','2026-01-12 17:00:00.000','cancelled',NULL,'Luis Soria',NULL,'2026-01-11 22:54:12.965','2026-01-13 15:30:25.944',1,18.00),('cmkacci780001e6mlz74gdqsh',NULL,'barber-2','service-1','2026-01-13 17:00:00.000','completed',NULL,'Álvaro Pedro',NULL,'2026-01-11 23:04:17.445','2026-01-13 17:48:00.291',0,18.00),('cmkb1f9pn0001mhgz4k9jh5cx','cmka01qe20003szigs1l8unuc','barber-3','service-4','2026-01-13 11:00:00.000','completed',NULL,NULL,NULL,'2026-01-12 10:46:16.811','2026-01-13 15:09:32.097',1,20.00),('cmkb2j3hx0001127iuvh0w7u5','cmka01qe20003szigs1l8unuc','barber-3','service-4','2026-01-14 09:00:00.000','scheduled',NULL,NULL,NULL,'2026-01-12 11:17:14.997','2026-01-13 16:34:09.151',0,20.00),('cmkb4aw0z0003127i9lbekvaw','cmka01qe20003szigs1l8unuc','barber-2','service-4','2026-01-22 08:00:00.000','scheduled',NULL,NULL,NULL,'2026-01-12 12:06:51.299','2026-01-13 14:43:57.003',0,20.00),('cmkbaed7y0001fwfpgynk7l3b','cmka01qe20003szigs1l8unuc','barber-4','service-4','2026-01-13 08:00:00.000','no_show','Llegaré cinco minutos tarde, disculpa las molestias.',NULL,NULL,'2026-01-12 14:57:31.246','2026-01-13 15:29:18.934',0,20.00),('cmkcr4vhv0001ahfnoi1ryadi','user-3','barber-3','service-3','2026-01-13 17:30:00.000','completed',NULL,NULL,NULL,'2026-01-13 15:33:48.020','2026-01-13 17:52:01.622',0,12.00),('cmkcricxi0003ahfnznm37pld','user-3','barber-2','service-4','2026-01-13 17:30:00.000','completed',NULL,NULL,NULL,'2026-01-13 15:44:17.142','2026-01-13 18:31:55.209',0,20.00),('cmkcrtsxu0005ahfnvxg7g20w','user-1','barber-3','service-5','2026-01-13 16:30:00.000','completed',NULL,NULL,NULL,'2026-01-13 15:53:11.107','2026-01-13 17:48:00.291',0,28.00),('cmkdr69ce0005j6b9v44nu354','cmka01qe20003szigs1l8unuc','barber-2','service-1','2026-01-14 09:00:00.000','scheduled',NULL,NULL,NULL,'2026-01-14 08:22:38.799','2026-01-14 08:22:38.799',0,18.00);
/*!40000 ALTER TABLE `Appointment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Barber`
--

DROP TABLE IF EXISTS `Barber`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Barber` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo` text COLLATE utf8mb4_unicode_ci,
  `specialty` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('worker','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'worker',
  `bio` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startDate` datetime(3) NOT NULL,
  `endDate` datetime(3) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `photoFileId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Barber_userId_key` (`userId`),
  CONSTRAINT `Barber_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Barber`
--

LOCK TABLES `Barber` WRITE;
/*!40000 ALTER TABLE `Barber` DISABLE KEYS */;
INSERT INTO `Barber` VALUES ('barber-1','Miguel Ángel',NULL,'Cortes clásicos','admin','Más de 15 años de experiencia en cortes tradicionales y modernos.','2024-01-01 00:00:00.000',NULL,1,NULL,'2026-01-07 14:01:15.412','2026-01-07 14:01:15.412',NULL),('barber-2','Alejandro Ruiz','https://ik.imagekit.io/iy4uhcv8c/leblond/barbers/barber-1768309145124_gSQOvNgHb.webp','Degradados & Fades','worker','Especialista en degradados y técnicas modernas de barbería.','2024-03-01 00:00:00.000',NULL,1,NULL,'2026-01-07 14:01:15.413','2026-01-13 12:59:06.239','696641995c7cd75eb8b23ec9'),('barber-3','David Fernández',NULL,'Barba & Afeitado','worker','Experto en cuidado de barba y afeitado tradicional con navaja.','2024-02-15 00:00:00.000',NULL,1,NULL,'2026-01-07 14:01:15.414','2026-01-07 14:01:15.414',NULL),('barber-4','Pablo Martín',NULL,'Estilos urbanos','worker','Creador de estilos únicos y tendencias urbanas.','2024-04-01 00:00:00.000',NULL,1,NULL,'2026-01-07 14:01:15.415','2026-01-07 14:01:15.415',NULL);
/*!40000 ALTER TABLE `Barber` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `BarberHoliday`
--

DROP TABLE IF EXISTS `BarberHoliday`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BarberHoliday` (
  `id` int NOT NULL AUTO_INCREMENT,
  `barberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start` datetime(3) NOT NULL,
  `end` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `BarberHoliday_barberId_fkey` (`barberId`),
  CONSTRAINT `BarberHoliday_barberId_fkey` FOREIGN KEY (`barberId`) REFERENCES `Barber` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `BarberHoliday`
--

LOCK TABLES `BarberHoliday` WRITE;
/*!40000 ALTER TABLE `BarberHoliday` DISABLE KEYS */;
INSERT INTO `BarberHoliday` VALUES (5,'barber-1','2025-12-20 00:00:00.000','2025-12-21 00:00:00.000','2026-01-07 14:01:15.433'),(6,'barber-2','2025-12-22 00:00:00.000','2025-12-23 00:00:00.000','2026-01-07 14:01:15.434'),(7,'barber-3','2025-12-18 00:00:00.000','2025-12-19 00:00:00.000','2026-01-07 14:01:15.434'),(8,'barber-4','2025-12-17 00:00:00.000','2025-12-17 00:00:00.000','2026-01-07 14:01:15.436'),(14,'barber-2','2026-01-23 00:00:00.000','2026-01-23 00:00:00.000','2026-01-12 12:07:20.390'),(16,'barber-1','2026-01-13 00:00:00.000','2026-01-13 00:00:00.000','2026-01-12 14:53:59.821'),(17,'barber-2','2026-01-15 00:00:00.000','2026-01-18 00:00:00.000','2026-01-12 16:04:20.426'),(18,'barber-4','2026-01-15 00:00:00.000','2026-01-18 00:00:00.000','2026-01-12 16:04:20.429');
/*!40000 ALTER TABLE `BarberHoliday` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `BarberSchedule`
--

DROP TABLE IF EXISTS `BarberSchedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BarberSchedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `barberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `BarberSchedule_barberId_key` (`barberId`),
  CONSTRAINT `BarberSchedule_barberId_fkey` FOREIGN KEY (`barberId`) REFERENCES `Barber` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `BarberSchedule`
--

LOCK TABLES `BarberSchedule` WRITE;
/*!40000 ALTER TABLE `BarberSchedule` DISABLE KEYS */;
/*!40000 ALTER TABLE `BarberSchedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `GeneralHoliday`
--

DROP TABLE IF EXISTS `GeneralHoliday`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GeneralHoliday` (
  `id` int NOT NULL AUTO_INCREMENT,
  `start` datetime(3) NOT NULL,
  `end` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `GeneralHoliday`
--

LOCK TABLES `GeneralHoliday` WRITE;
/*!40000 ALTER TABLE `GeneralHoliday` DISABLE KEYS */;
INSERT INTO `GeneralHoliday` VALUES (5,'2025-01-01 00:00:00.000','2025-01-01 00:00:00.000','2026-01-07 14:01:15.429'),(6,'2025-01-06 00:00:00.000','2025-01-06 00:00:00.000','2026-01-07 14:01:15.430'),(7,'2025-03-18 00:00:00.000','2025-03-19 00:00:00.000','2026-01-07 14:01:15.431'),(8,'2025-12-24 00:00:00.000','2025-12-26 00:00:00.000','2026-01-07 14:01:15.432');
/*!40000 ALTER TABLE `GeneralHoliday` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Offer`
--

DROP TABLE IF EXISTS `Offer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Offer` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discountType` enum('percentage','amount') COLLATE utf8mb4_unicode_ci NOT NULL,
  `discountValue` decimal(10,2) NOT NULL,
  `scope` enum('all','categories','services') COLLATE utf8mb4_unicode_ci NOT NULL,
  `startDate` datetime(3) DEFAULT NULL,
  `endDate` datetime(3) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Offer`
--

LOCK TABLES `Offer` WRITE;
/*!40000 ALTER TABLE `Offer` DISABLE KEYS */;
INSERT INTO `Offer` VALUES ('cmk3d0irn0001edp1ff168zra','promo puntual',NULL,'amount',2.00,'all','2026-01-06 00:00:00.000','2026-01-08 00:00:00.000',1,'2026-01-07 01:48:34.691','2026-01-07 02:21:35.543');
/*!40000 ALTER TABLE `Offer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Service`
--

DROP TABLE IF EXISTS `Service`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Service` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `duration` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `categoryId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Service_categoryId_idx` (`categoryId`),
  CONSTRAINT `Service_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ServiceCategory` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Service`
--

LOCK TABLES `Service` WRITE;
/*!40000 ALTER TABLE `Service` DISABLE KEYS */;
INSERT INTO `Service` VALUES ('service-1','Corte clásico','Corte tradicional con tijera y máquina, incluye lavado.',18.00,30,'2026-01-07 14:01:15.415','2026-01-07 14:01:15.415',NULL),('service-2','Degradado fade','Corte con degradado profesional, varios estilos disponibles.',22.00,45,'2026-01-07 14:01:15.417','2026-01-07 14:01:15.417',NULL),('service-3','Arreglo de barba','Perfilado y recorte de barba con acabado perfecto.',12.00,20,'2026-01-07 14:01:15.418','2026-01-07 14:01:15.418',NULL),('service-4','Afeitado clásico','Afeitado tradicional con navaja y toalla caliente.',20.00,35,'2026-01-07 14:01:15.419','2026-01-07 14:01:15.419',NULL),('service-5','Corte + Barba','Combo completo: corte de pelo y arreglo de barba.',28.00,60,'2026-01-07 14:01:15.420','2026-01-07 14:01:15.420',NULL),('service-6','Tratamiento capilar','Tratamiento hidratante y nutritivo para el cabello.',15.00,45,'2026-01-07 14:01:15.421','2026-01-07 14:01:15.421',NULL);
/*!40000 ALTER TABLE `Service` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ServiceCategory`
--

DROP TABLE IF EXISTS `ServiceCategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ServiceCategory` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ServiceCategory`
--

LOCK TABLES `ServiceCategory` WRITE;
/*!40000 ALTER TABLE `ServiceCategory` DISABLE KEYS */;
INSERT INTO `ServiceCategory` VALUES ('cmk3bca0f0000d9etwcnd0mb3','Principales','Los más pedidos',1,'2026-01-07 01:01:43.983','2026-01-07 01:03:55.744'),('cmk3bd7bg0001d9etmjwaiuzc','Nuevos','Los servicios más nuevos',0,'2026-01-07 01:02:27.148','2026-01-07 01:03:40.987');
/*!40000 ALTER TABLE `ServiceCategory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ShopSchedule`
--

DROP TABLE IF EXISTS `ShopSchedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ShopSchedule` (
  `id` int NOT NULL DEFAULT '1',
  `data` json NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ShopSchedule`
--

LOCK TABLES `ShopSchedule` WRITE;
/*!40000 ALTER TABLE `ShopSchedule` DISABLE KEYS */;
INSERT INTO `ShopSchedule` VALUES (1,'{\"friday\": {\"closed\": false, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": true}, \"afternoon\": {\"end\": \"21:00\", \"start\": \"15:00\", \"enabled\": true}}, \"monday\": {\"closed\": true, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": false}, \"afternoon\": {\"end\": \"20:00\", \"start\": \"15:00\", \"enabled\": false}}, \"sunday\": {\"closed\": true, \"morning\": {\"end\": \"00:00\", \"start\": \"00:00\", \"enabled\": false}, \"afternoon\": {\"end\": \"00:00\", \"start\": \"00:00\", \"enabled\": false}}, \"tuesday\": {\"closed\": false, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": true}, \"afternoon\": {\"end\": \"20:00\", \"start\": \"15:00\", \"enabled\": true}}, \"saturday\": {\"closed\": false, \"morning\": {\"end\": \"13:30\", \"start\": \"09:30\", \"enabled\": true}, \"afternoon\": {\"end\": \"18:00\", \"start\": \"15:30\", \"enabled\": true}}, \"thursday\": {\"closed\": false, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": true}, \"afternoon\": {\"end\": \"20:00\", \"start\": \"15:00\", \"enabled\": true}}, \"wednesday\": {\"closed\": false, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": true}, \"afternoon\": {\"end\": \"20:00\", \"start\": \"15:00\", \"enabled\": true}}}','2026-01-13 13:08:35.534');
/*!40000 ALTER TABLE `ShopSchedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SiteSettings`
--

DROP TABLE IF EXISTS `SiteSettings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SiteSettings` (
  `id` int NOT NULL DEFAULT '1',
  `data` json NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SiteSettings`
--

LOCK TABLES `SiteSettings` WRITE;
/*!40000 ALTER TABLE `SiteSettings` DISABLE KEYS */;
INSERT INTO `SiteSettings` VALUES (1,'{\"stats\": {\"averageRating\": 4.5, \"yearlyBookings\": 5000, \"experienceStartYear\": 2020, \"repeatClientsPercentage\": 85}, \"contact\": {\"email\": \"info.leblondhairsalon@gmail.com\", \"phone\": \"+34656610045\"}, \"socials\": {\"x\": \"\", \"tiktok\": \"\", \"youtube\": \"\", \"linkedin\": \"\", \"instagram\": \"leblondhairsalon\"}, \"branding\": {\"name\": \"Le Blond Hair Salon\", \"tagline\": \"Tu look, nuestro compromiso.\", \"shortName\": \"Le Blond\", \"description\": \"Estamos en Canet d\'en Berenguer y nos dedicamos a crear cortes, color y peinados a medida para quienes buscan estilo y cuidado premium.\"}, \"location\": {\"label\": \"Canet d\'en Berenguer (Valencia)\", \"mapUrl\": \"https://www.google.com/maps/place/Le+Blond+Hair+Salon/@39.68116,-0.207122,14587m/data=!3m1!1e3!4m6!3m5!1s0xd601740819dc665:0x309bee06711ecc9b!8m2!3d39.6811601!4d-0.2071223!16s%2Fg%2F11vd759r3v\", \"mapEmbedUrl\": \"https://www.google.com/maps?q=Le+Blond+Hair+Salon&output=embed\"}, \"services\": {\"categoriesEnabled\": false}, \"qrSticker\": {\"url\": \"http://localhost:8080/\", \"imageUrl\": \"https://ik.imagekit.io/iy4uhcv8c/leblond/barbers/qr-stickers/qr-le-blond_IHe3T7KHA.png\", \"createdAt\": \"2026-01-13T13:08:35.520Z\", \"imageFileId\": \"696643d35c7cd75eb8c23a48\"}, \"openingHours\": {\"friday\": {\"closed\": false, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": true}, \"afternoon\": {\"end\": \"21:00\", \"start\": \"15:00\", \"enabled\": true}}, \"monday\": {\"closed\": true, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": false}, \"afternoon\": {\"end\": \"20:00\", \"start\": \"15:00\", \"enabled\": false}}, \"sunday\": {\"closed\": true, \"morning\": {\"end\": \"00:00\", \"start\": \"00:00\", \"enabled\": false}, \"afternoon\": {\"end\": \"00:00\", \"start\": \"00:00\", \"enabled\": false}}, \"tuesday\": {\"closed\": false, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": true}, \"afternoon\": {\"end\": \"20:00\", \"start\": \"15:00\", \"enabled\": true}}, \"saturday\": {\"closed\": false, \"morning\": {\"end\": \"13:30\", \"start\": \"09:30\", \"enabled\": true}, \"afternoon\": {\"end\": \"18:00\", \"start\": \"15:30\", \"enabled\": true}}, \"thursday\": {\"closed\": false, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": true}, \"afternoon\": {\"end\": \"20:00\", \"start\": \"15:00\", \"enabled\": true}}, \"wednesday\": {\"closed\": false, \"morning\": {\"end\": \"14:00\", \"start\": \"09:00\", \"enabled\": true}, \"afternoon\": {\"end\": \"20:00\", \"start\": \"15:00\", \"enabled\": true}}}}','2026-01-13 13:08:35.529');
/*!40000 ALTER TABLE `SiteSettings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firebaseUid` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('client','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'client',
  `notificationEmail` tinyint(1) NOT NULL DEFAULT '1',
  `notificationWhatsapp` tinyint(1) NOT NULL DEFAULT '0',
  `avatar` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSuperAdmin` tinyint(1) NOT NULL DEFAULT '0',
  `adminRoleId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `prefersBarberSelection` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`),
  UNIQUE KEY `User_firebaseUid_key` (`firebaseUid`),
  KEY `User_adminRoleId_fkey` (`adminRoleId`),
  CONSTRAINT `User_adminRoleId_fkey` FOREIGN KEY (`adminRoleId`) REFERENCES `AdminRole` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User`
--

LOCK TABLES `User` WRITE;
/*!40000 ALTER TABLE `User` DISABLE KEYS */;
INSERT INTO `User` VALUES ('cmka01qe20003szigs1l8unuc','KEqTCUoT11cuOJl5U8zwFicDwmk1','Carlos López Monreal','c.lopemonre@gmail.com','','client',1,1,'https://lh3.googleusercontent.com/a/ACg8ocLMQ59txKm3fDznpcFuJ4LmQI_C3EXlFXpgSOpK7rdThqHxFw=s96-c',0,NULL,'2026-01-11 17:19:59.451','2026-01-14 08:33:32.645',0),('cmkdr25ff0001j6b979qmrzbr','x42vFe8ikqVTh9yVCGD0hm4NXBo1','Carlos López','carloslopezmonreal@gmail.com',NULL,'client',1,1,'https://lh3.googleusercontent.com/a/ACg8ocJ7qaqBdn_1133nMY3C0kFTlmL0pms91j1T6b9PDj8w--4Xhg=s96-c',0,NULL,'2026-01-14 08:19:27.100','2026-01-14 08:19:27.106',1),('user-1',NULL,'Carlos García','carlos@example.com','+34 612 345 678','client',1,1,NULL,0,NULL,'2026-01-07 14:01:15.405','2026-01-07 14:01:15.405',1),('user-2','xS5HAkFRyXNaUsxT8s3rVBXjmup2','Carlos López Monreal','admin@barberia.com','+34 600 000 000','admin',1,0,NULL,1,NULL,'2026-01-07 14:01:15.407','2026-01-14 08:19:37.603',1),('user-3',NULL,'María López','maria@example.com','+34 698 765 432','client',0,1,NULL,0,NULL,'2026-01-07 14:01:15.409','2026-01-07 14:01:15.409',1);
/*!40000 ALTER TABLE `User` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-14  9:39:41
