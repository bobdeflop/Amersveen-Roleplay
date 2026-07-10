const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// 1. Webserver voor Render.com (om 24/7 online te blijven)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Amersveen Roleplay Bot is 24/7 Online!'));
app.listen(PORT, () => console.log(`Webserver draait op poort ${PORT}`));

// 2. Discord Client aanmaken
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// ID van de Beheer rol die het commando mag gebruiken
const BEHEER_ROL_ID = "1503075102244208710";

// Een tijdelijke database in het geheugen om deelnemers per giveaway bij te houden
const giveaways = new Map();

client.once('ready', async () => {
    console.log(`Ingelogd als ${client.user.tag}! Amersveen RP is ready.`);

    // Registreer het /giveaway slash-commando in Discord
    const guildId = "1503066590579523616"; // VUL HIER JE DISCORD SERVER ID IN!
    const guild = client.guilds.cache.get(guildId);
    
    if (guild) {
        await guild.commands.set([
            {
                name: 'giveaway',
                description: 'Host een giveaway voor Amersveen Roleplay',
                options: [
                    {
                        name: 'titel',
                        type: 3, // STRING
                        description: 'Wat valt er te winnen?',
                        required: true
                    },
                    {
                        name: 'tijd',
                        type: 4, // INTEGER
                        description: 'Hoeveel minuten duurt de giveaway?',
                        required: true
                    },
                    {
                        name: 'winnaars',
                        type: 4, // INTEGER
                        description: 'Aantal winnaars',
                        required: true
                    },
                    {
                        name: 'beschrijving',
                        type: 3, // STRING
                        description: 'Extra informatie over de gever',
                        required: false
                    }
                ]
            }
        ]);
        console.log("Slash commando's succesvol geregistreerd!");
    }
});

// Luisteren naar commando's en knoppen
client.on('interactionCreate', async (interaction) => {
    // 3. Slash Commando Verwerking
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'giveaway') {
            // Checken of het lid de Beheer rol heeft
            if (!interaction.member.roles.cache.has(BEHEER_ROL_ID)) {
                return interaction.reply({ content: '❌ Jij hebt geen toestemming (Beheer-rol vereist) om een giveaway te starten!', ephemeral: true });
            }

            const titel = interaction.options.getString('titel');
            const tijdMinuten = interaction.options.getInteger('tijd');
            const aantalWinnaars = interaction.options.getInteger('winnaars');
            const beschrijving = interaction.options.getString('beschrijving') || 'Geen extra beschrijving meegegeven.';

            const eindTijdUiterlijk = Math.floor((Date.now() + tijdMinuten * 60000) / 1000);

            // Maak de Embed (het mooie bericht)
            const giveawayEmbed = new EmbedBuilder()
                .setTitle(`🎉 GIVEAWAY: ${titel} 🎉`)
                .setDescription(`${beschrijving}\n\n• **Aantal winnaars:** ${aantalWinnaars}\n• **Eindigt:** <t:${eindTijdUiterlijk}:R> (<t:${eindTijdUiterlijk}:F>)\n• **Gehost door:** ${interaction.user}`)
                .setColor('#0099ff')
                .setFooter({ text: 'Amersveen Roleplay | Klik op de knop om mee te doen!' });

            // Maak de Meedoen-knop
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('Meedoen! 🎉')
                    .setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.reply({ embeds: [giveawayEmbed], components: [row], fetchReply: true });

            // Sla de giveaway gegevens op
            giveaways.set(msg.id, {
                titel: titel,
                winnaars: aantalWinnaars,
                deelnemers: [],
                eindigt: Date.now() + tijdMinuten * 60000
            });

            // Timer die afloopt wanneer de giveaway klaar is
            setTimeout(async () => {
                const data = giveaways.get(msg.id);
                if (!data) return;

                const knopUit = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('join_giveaway')
                        .setLabel('Gesloten 🔒')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                if (data.deelnemers.length === 0) {
                    const verlopenEmbed = EmbedBuilder.from(giveawayEmbed)
                        .setDescription(`**De giveaway is afgelopen!**\n\nEr waren helaas geen deelnemers.`);
                    await interaction.editReply({ embeds: [verlopenEmbed], components: [knopUit] });
                    return interaction.followUp(`🎉 De giveaway voor **${data.titel}** is afgelopen, maar niemand heeft meegedaan.`);
                }

                // Kies willekeurige winnaars
                const gekozenWinnaars = [];
                const aantalOmTeKiezen = Math.min(data.winnaars, data.deelnemers.length);

                while (gekozenWinnaars.length < aantalOmTeKiezen) {
                    const randomUser = data.deelnemers[Math.floor(Math.random() * data.deelnemers.length)];
                    if (!gekozenWinnaars.includes(randomUser)) {
                        gekozenWinnaars.push(randomUser);
                    }
                }

                const winnaarsMentions = gekozenWinnaars.map(id => `<@${id}>`).join(', ');

                const winnaarEmbed = EmbedBuilder.from(giveawayEmbed)
                    .setDescription(`**De giveaway is afgelopen!**\n\n🏆 **Winnaar(s):** ${winnaarsMentions}`)
                    .setColor('#00ff00');

                await interaction.editReply({ embeds: [winnaarEmbed], components: [knopUit] });
                await interaction.followUp(`Gefeliciteerd ${winnaarsMentions}! Je hebt **${data.titel}** gewonnen! 🏆`);
                
                giveaways.delete(msg.id);
            }, tijdMinuten * 60000);
        }
    }

    // 4. Knop Klikken Verwerking
    if (interaction.isButton()) {
        if (interaction.customId === 'join_giveaway') {
            const data = giveaways.get(interaction.message.id);
            if (!data) {
                return interaction.reply({ content: '❌ Deze giveaway is al afgelopen of de bot is herstart.', ephemeral: true });
            }

            if (data.deelnemers.includes(interaction.user.id)) {
                return interaction.reply({ content: 'ℹ️ Je doet al mee aan deze giveaway!', ephemeral: true });
            }

            // Voeg de speler toe aan de lijst
            data.deelnemers.push(interaction.user.id);
            giveaways.set(interaction.message.id, data);

            return interaction.reply({ content: '🎉 Je doet nu officieel mee aan de giveaway! Veel succes!', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);