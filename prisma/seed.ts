
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Clearing existing data...`);
  // Deleting in order to respect foreign key constraints
  // This list will grow as you provide more data for other tables.
  await prisma.user.deleteMany();
  await prisma.pmoDivision.deleteMany();
  await prisma.projectStatus.deleteMany();
  console.log('Existing data for PmoDivision, ProjectStatus, and User cleared.');

  console.log(`Start seeding ...`);

  // Seed PmoDivision
  const pmoDivisions = [
    { id: 'cmd9x99ac0000i97q9ix8c3mw', name: 'Technical Programs', responsibleName: 'Biruk Zegeju', responsibleTitle: 'Director', responsiblePhone: '0913212762' },
    { id: 'cmdpxd9a70000124g162t79of', name: 'Business', responsibleName: 'Nigatu Wolde', responsibleTitle: 'Director Business Programs', responsiblePhone: '0911467473' },
    { id: 'cmf7vr5kv00hinsa9lkjs3orn', name: 'project control & quality assurance', responsibleName: 'Demesiew Mekonon', responsibleTitle: 'Principal project control & quality assurance officer', responsiblePhone: '0920314800' },
    { id: 'cme9l4u8b003bq3fbzqn691a9', name: 'Construction  Project Management', responsibleName: 'Nebiyat Kibru', responsibleTitle: 'Manager Construction Project Management', responsiblePhone: '0911136447' },
  ];
  for (const pmo of pmoDivisions) {
    await prisma.pmoDivision.upsert({ where: { id: pmo.id }, update: {}, create: pmo });
  }
  console.log(`Seeded ${pmoDivisions.length} PMO divisions.`);

  // Seed ProjectStatus
  const statuses = [
    { id: 'cmd9uod1d0009n23qpz8vce1n', name: 'Active' },
    { id: 'cmd9uod1g000an23qw5l4bj7b', name: 'Pending' },
    { id: 'cmd9uod1i000bn23qd6z0oxcb', name: 'Parked' },
    { id: 'cmd9uod1k000cn23q40o6shng', name: 'Completed' },
    { id: 'cmeqtmei7008ansa9jz4r0d0a', name: 'On Handover' },
  ];
  for (const status of statuses) {
    await prisma.projectStatus.upsert({ where: { id: status.id }, update: {}, create: status });
  }
  console.log(`Seeded ${statuses.length} project statuses.`);

  // Seed Users
  const users = [
    { id: 'af39280d-3566-4dc9-8349-ef7b39dd9528', name: 'Tadele Mesfin', firstName: 'Tadele', lastName: 'Mesfin', email: 'tade2024bdu@gmail.com', phoneNumber: '0949847581', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'd2ac6453-bd35-448f-a4ee-7dd01f273841', name: 'Biruk Zegeju', firstName: 'Biruk', lastName: 'Zegeju', email: 'biruk.zegeju@nibbank.com.et', phoneNumber: '0913212762', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '65966ee4-e94e-4399-aaf8-a78c9d09d54d', name: 'Robel Asaminew', firstName: 'Robel', lastName: 'Asaminew', email: 'robelas2001@gmail.com', phoneNumber: '0912348714', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '8170bace-2ba8-404d-b6ed-e4e9e5ad371e', name: 'Hawi Tulu', firstName: 'Hawi', lastName: 'Tulu', email: 'hawitulu71@gmail.com', phoneNumber: '0953711970', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '04177a31-1b71-44ce-83df-e113f91e5d47', name: 'Nigatu  Wolde', firstName: 'Nigatu', lastName: ' Wolde', email: 'Nigatu.Wolde@nibbank.com.et', phoneNumber: '0911467473', pmoDivisionId: 'cmdpxd9a70000124g162t79of' },
    { id: '4f137a6d-e073-40cd-af5f-ca9eb91972c9', name: 'Blen Kassahun', firstName: 'Blen', lastName: 'Kassahun', email: 'blennib12@gmail.com', phoneNumber: '0908279572', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '52a33a74-18f5-4d11-a778-f6d128141db5', name: 'Henok Kebede', firstName: 'Henok', lastName: 'Kebede', email: 'Henok.Kebede@nibbank.com.et', phoneNumber: '0911207796', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'f41af949-619e-4bde-9410-1e19297c3c44', name: 'Admin Admin', firstName: 'Admin', lastName: 'Admin', email: 'Admin@gmail.com', phoneNumber: '0912345678', pmoDivisionId: null },
    { id: 'a7148ece-c2e2-4d38-b7b5-1a21ff34349f', name: 'Alhamdu Yajbo', firstName: 'Alhamdu', lastName: 'Yajbo', email: 'www.alex94lykam@gmail.com', phoneNumber: '0933480007', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '8f3aea2b-70fa-4a0f-a467-e9227cc2eead', name: 'Tony Solomon', firstName: 'Tony', lastName: 'Solomon', email: 'Tony.solomon@nibbank.com.et', phoneNumber: '962206017', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'ff4c3f26-32df-430f-8a6b-a089e3da0978', name: 'Abiy Hailemichael', firstName: 'Abiy', lastName: 'Hailemichael', email: 'Abiy.Hmichael@nibbank.com.et', phoneNumber: '0932489095', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '83c0e4a3-a31c-4755-a532-5ee043fb4f7b', name: 'Bogale  Teferedegn', firstName: 'Bogale ', lastName: 'Teferedegn', email: 'Bogale.Teferedegne@nibbank.com.et', phoneNumber: '0911883446', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '16aed8ba-d6cf-4672-97eb-e970e742804e', name: 'Nuhamin Mihretu', firstName: 'Nuhamin', lastName: 'Mihretu', email: 'shifteher@gmail.com', phoneNumber: '0949602907', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '77216fcf-2173-47c9-86c8-b628f841a9e6', name: 'Haimanot Degemu', firstName: 'Haimanot', lastName: 'Degemu', email: 'haymidegemu@gmail.com', phoneNumber: '0909255035', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'e32ea084-196b-4dcb-b3fc-f49621326a3b', name: 'Fiseha Tesfaye', firstName: 'Fiseha', lastName: 'Tesfaye', email: 'Fiseha.Tesfaye@nibbank.com.et', phoneNumber: '0913384359', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '09e90d0e-1f4f-4ea6-9a7d-668992cfe0a0', name: 'Aliy Umer', firstName: 'Aliy', lastName: 'Umer', email: 'aliyumer44@gmail.com', phoneNumber: '0949385646', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'b529c8af-05ea-4100-820a-4853f2b74a4b', name: 'Demesiew Mekonon', firstName: 'Demesiew', lastName: 'Mekonon', email: 'demesew11@gmail.com', phoneNumber: '0920314800', pmoDivisionId: 'cmf7vr5kv00hinsa9lkjs3orn' },
    { id: '1abe377e-a3b3-4f9b-9776-318c6a4f32b5', name: 'Bereket  Kiflemariam', firstName: 'Bereket ', lastName: 'Kiflemariam', email: 'Bereket.Kiflemariam@nibbank.com.et', phoneNumber: '0920740711', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '6afdd002-b7a4-4a9a-9a53-61a04f84b4f2', name: 'Matewos  Chalchissa  ', firstName: 'Matewos ', lastName: 'Chalchissa  ', email: 'Matewos.Chalchissa@nibbank.com.et', phoneNumber: '0913810850', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '34b81c8a-54c4-4fd2-ab0b-9e5a64d17eb1', name: 'Meseret Melkamu', firstName: 'Meseret', lastName: 'Melkamu', email: 'meseret.melkamu@nibbank.com', phoneNumber: '0953241316', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '57235f4e-f149-49d7-bcb1-07403bf22bf4', name: 'Tirukelem Mekuriaw', firstName: 'Tirukelem', lastName: 'Mekuriaw', email: 'tirumeku2008@gmail.com', phoneNumber: '0989736223', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '6614a11b-65f1-46ec-a19c-c27834689bb2', name: 'Mohammed Bedru', firstName: 'Mohammed', lastName: 'Bedru', email: 'Moammed.bedru@nibbank.com.et', phoneNumber: '0967028093', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '3edb0a77-0673-4d4e-bcdb-359b8b7deb8b', name: 'Aschalew   Gebreyes ', firstName: 'Aschalew  ', lastName: 'Gebreyes ', email: 'Aschalew.Gebreyes@nibbank.com.et', phoneNumber: '0913662427', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '2c7adf95-9829-4904-b861-9eb3c6c531ca', name: 'Desalegn   Fikru ', firstName: 'Desalegn  ', lastName: 'Fikru ', email: 'Desalegn.Fikru@nibbank.com.et', phoneNumber: '0911151212', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'f993ab98-9721-4290-8130-b251c751496b', name: 'Shusahy  Taddesse', firstName: 'Shusahy ', lastName: 'Taddesse', email: 'Shusahy.Taddesse@nibbank.com.et', phoneNumber: '0913206069', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '21e9ac23-e99d-48ca-9197-3c81f87e38e3', name: 'Maru  Dagne', firstName: 'Maru ', lastName: 'Dagne', email: 'Maru.Dagne@nibbank.com.et', phoneNumber: '0913876212', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '6efe988f-c08e-4ae9-99ea-00efeb4e8912', name: 'Burkitu Melka', firstName: 'Burkitu', lastName: 'Melka', email: 'burkitu.melka@nibbank.com.et', phoneNumber: '0976760656', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'e2953dfd-250e-4254-875f-1f4797950988', name: 'Getaye Temesgen', firstName: 'Getaye', lastName: 'Temesgen', email: 'Getaye.temesgen@nibbank.com.et', phoneNumber: '0933704978', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '0de0441c-87a7-4ccf-9e75-24863881cb6f', name: 'Desalegn  Fuje ', firstName: 'Desalegn ', lastName: 'Fuje ', email: 'Desalegn.Fuje@nibbank.com.et', phoneNumber: '0969138580', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'cd95a4f9-2558-409a-a40c-117c81ba30ee', name: 'Kokeb Diriba', firstName: 'Kokeb', lastName: 'Diriba', email: 'Kokeb.Diriba@nibbank.com.et', phoneNumber: '0911728721', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: 'e6e8c6f5-44ab-4c6f-a566-35e3d9ae2556', name: 'Dejene Degefa', firstName: 'Dejene', lastName: 'Degefa', email: 'Dejene.Degefa@nibbank.com.et', phoneNumber: '0913753510', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '61cfc73f-ba90-41a0-ba05-f512bf9f5fe8', name: 'Soliana Daniel ', firstName: 'Soliana', lastName: 'Daniel ', email: 'soliana.daniel@nibbank.com', phoneNumber: '0940929389', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '49d9f127-e78e-4275-a164-21b8ca5b1806', name: 'Dr. Tamirat  Dessie', firstName: 'Dr. Tamirat ', lastName: 'Dessie', email: 'tamirat.dessie@nibbank.et.com', phoneNumber: '0913327947', pmoDivisionId: 'cmdpxd9a70000124g162t79of' },
    { id: '3733c259-5e95-4071-9f03-2d56280fa2e3', name: 'Biruk Getachew', firstName: 'Biruk', lastName: 'Getachew', email: 'biruk.getachew@nibbank.com.et', phoneNumber: '0920249797', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '2824678e-bbcc-443f-bd66-fafcb56302f4', name: 'Henok Alemayehu', firstName: 'Henok', lastName: 'Alemayehu', email: 'henok.alemayehu@nibbank.com.et', phoneNumber: '0911122518', pmoDivisionId: 'cmd9x99ac0000i97q9ix8c3mw' },
    { id: '8190d828-5098-445b-9cc9-a8088e39bd42', name: 'Nebiyat Kibru', firstName: 'Nebiyat', lastName: 'Kibru', email: 'nebikibru@gmail.com', phoneNumber: '0911136447', pmoDivisionId: 'cme9l4u8b003bq3fbzqn691a9' },
  ];
  for (const userData of users) {
    // We are not connecting roles here as the Role data is not yet provided.
    // This will be done in a later step.
    await prisma.user.upsert({
      where: { id: userData.id },
      update: {},
      create: {
        ...userData,
        avatar: `https://i.pravatar.cc/150?u=${userData.id}`,
      }
    });
  }
  console.log(`Seeded ${users.length} users.`);
  

  console.log(`Seeding finished for this batch.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
