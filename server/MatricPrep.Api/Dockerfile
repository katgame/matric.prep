FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["NuGet.Config", "./"]
COPY ["MatricPrep.Api.csproj", "./"]
RUN dotnet restore "./MatricPrep.Api.csproj"

COPY . .
RUN dotnet publish "./MatricPrep.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "MatricPrep.Api.dll"]

