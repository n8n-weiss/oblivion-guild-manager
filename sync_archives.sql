-- SYNC ARCHIVED MEMBERS FROM LEGACY CSV
-- This adds the 27 members who "left" but need to be archived in the new system

INSERT INTO public.roster (member_id, ign, class, role, discord, guild_rank, status)
VALUES
('OBL051818', 'Briose', 'Assassin Cross', 'DPS', 'Briose', 'Member', 'left'),
('OBL173573', 'BananaSundae', 'High Priest', 'Support', '..jtobes', 'Member', 'left'),
('OBL173578', 'Zinji', 'Scholar (Professor)', 'DPS', 'wrongwholeoniichan', 'Member', 'left'),
('OBL173603', 'Antukin', 'Biochemist (Creator)', 'DPS', '', 'Member', 'left'),
('OBL173620', 'VanHawk', 'Summoner', 'DPS', 'nunalnimina', 'Member', 'left'),
('OBL173644', 'Umber', 'Gypsy', 'Support', 'um_ber', 'Member', 'left'),
('OBL173697', 'Koala', 'Lord Knight', 'DPS', '_arcutect', 'Member', 'left'),
('OBL173780', 'Puyatera', 'Gypsy', 'Support', 'krn0513', 'Member', 'left'),
('OBL173801', 'Chika', 'High Priest', 'Support', 'Chika', 'Member', 'left'),
('OBL173875', 'PanCake', 'Assassin Cross', 'DPS', 'pancake050607', 'Member', 'left'),
('OBL187686', 'Zetsu', 'Minstrel (Clown)', 'Support', 'stayzetsu', 'Member', 'left'),
('OBL195608', 'BuLaN', 'High Priest', 'Support', 'Bulan717', 'Member', 'left'),
('OBL195814', 'HesuCrypto', 'Assassin Cross', 'DPS', 'hesucrypto_666', 'Member', 'left'),
('OBL212529', 'zQwertyQt', 'Paladin', 'Support', 'QwertyQT', 'Member', 'left'),
('OBL221553', 'ichi', 'High Priest', 'Support', 'coffeecheezecigar', 'Member', 'left'),
('OBL240400', 'Snap', 'Gypsy', 'Support', 'snap.06', 'Member', 'left'),
('OBL244754', 'WipeWipeWipe', 'Sniper', 'DPS', 'WipeWipeWipe', 'Member', 'left'),
('OBL312059', 'Mech', 'Minstrel (Clown)', 'Support', 'HIGH GROUNDS#4535', 'Member', 'left'),
('OBL314141', 'Hollgrehenn', 'Minstrel (Clown)', 'Support', 'hollgrehenn02', 'Member', 'left'),
('OBL334859', 'KasuyTV', 'Minstrel (Clown)', 'Support', 'kasuy.tv', 'Member', 'left'),
('OBL355833', 'RArmuru', 'Lord Knight', 'DPS', 'SEPHHH.', 'Member', 'left'),
('OBL367555', 'Bhonju', 'Paladin', 'Support', 'Bhonju', 'Member', 'left'),
('OBL471999', 'Reinberg', 'High Priest', 'Support', 'reinberg31', 'Member', 'left'),
('OBL537143', 'HexileD', 'High Priest', 'Support', 'ExilE', 'Member', 'left'),
('OBL564356', 'Legionella', 'Stalker', 'DPS', 'kwago1499u', 'Member', 'left'),
('OBL594881', 'Enma', 'High Priest', 'Support / Utility', 'Enma', 'Member', 'left'),
('OBL623684', 'dennlsaur', 'High Priest', 'Support / Utility', 'dennisaur', 'Member', 'left')
ON CONFLICT (member_id) DO UPDATE SET 
    status = 'left';

